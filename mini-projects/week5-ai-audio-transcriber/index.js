/**
 * week5-ai-transcriber — Lambda handler
 *
 * Trigger : S3 PutObject on the audio bucket
 * Flow    : S3 event → Amazon Transcribe (speech-to-text)
 *           → poll until complete → Amazon Translate
 *           → write results JSON back to S3 (results/ prefix)
 *           → API Gateway GET /result/:jobName returns the JSON
 */

const {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
} = require("@aws-sdk/client-transcribe");

const {
  TranslateClient,
  TranslateTextCommand,
} = require("@aws-sdk/client-translate");

const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");

const https = require("https");

// ── clients (region from env, credentials from execution role) ──
const REGION = process.env.AWS_REGION || "ap-south-1";
const RESULTS_BUCKET = process.env.RESULTS_BUCKET; // same bucket, results/ prefix
const TARGET_LANGUAGES = (process.env.TARGET_LANGUAGES || "hi,fr,es,de").split(",");

const transcribe = new TranscribeClient({ region: REGION });
const translate  = new TranslateClient({ region: REGION });
const s3         = new S3Client({ region: REGION });

// ── helpers ─────────────────────────────────────────────────────

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Poll Transcribe until the job completes or fails.
 * Fargate Lambda max timeout is 15 min; audio files ≤ 5 min should be fine.
 */
async function waitForTranscription(jobName, maxWaitMs = 600_000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const { TranscriptionJob: job } = await transcribe.send(
      new GetTranscriptionJobCommand({ TranscriptionJobName: jobName })
    );
    const status = job.TranscriptionJobStatus;
    if (status === "COMPLETED") return job;
    if (status === "FAILED") throw new Error(`Transcribe job failed: ${job.FailureReason}`);
    await sleep(5_000);
  }
  throw new Error("Transcription timed out");
}

/**
 * Fetch the transcript JSON from the Transcribe output URL.
 */
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

/**
 * Translate text into each target language.
 * Returns { langCode: translatedText, ... }
 */
async function translateAll(text, sourceLang) {
  const results = {};
  await Promise.all(
    TARGET_LANGUAGES.map(async (lang) => {
      if (lang === sourceLang) { results[lang] = text; return; }
      try {
        const { TranslatedText } = await translate.send(
          new TranslateTextCommand({
            Text: text.slice(0, 5000), // Translate limit per call
            SourceLanguageCode: sourceLang,
            TargetLanguageCode: lang,
          })
        );
        results[lang] = TranslatedText;
      } catch (err) {
        console.warn(`Translate to ${lang} failed:`, err.message);
        results[lang] = null;
      }
    })
  );
  return results;
}

// ── main handler ─────────────────────────────────────────────────

exports.handler = async (event) => {
  console.log("Event:", JSON.stringify(event));

  // ── Branch A: S3 trigger ──────────────────────────────────────
  if (event.Records) {
    const results = [];

    for (const record of event.Records) {
      const bucket = record.s3.bucket.name;
      const key    = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

      // Only process audio uploads (not our own results/ writes)
      if (key.startsWith("results/")) {
        console.log("Skipping results/ key:", key);
        continue;
      }

      const jobName = `transcribe-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const s3Uri   = `s3://${bucket}/${key}`;

      console.log(`Starting transcription job ${jobName} for ${s3Uri}`);

      // Detect media format from extension
      const ext = key.split(".").pop().toLowerCase();
      const mediaFormatMap = { mp3: "mp3", mp4: "mp4", wav: "wav", flac: "flac", ogg: "ogg", webm: "webm", m4a: "mp4" };
      const mediaFormat = mediaFormatMap[ext] || "mp3";

      await transcribe.send(new StartTranscriptionJobCommand({
        TranscriptionJobName: jobName,
        Media: { MediaFileUri: s3Uri },
        MediaFormat: mediaFormat,
        LanguageCode: process.env.SOURCE_LANGUAGE || "en-US",
        OutputBucketName: RESULTS_BUCKET || bucket,
        OutputKey: `results/transcripts/${jobName}.json`,
      }));

      const completedJob = await waitForTranscription(jobName);

      // Fetch transcript text from the output
      const transcriptUri = completedJob.Transcript.TranscriptFileUri;
      const transcriptData = await fetchJson(transcriptUri);
      const transcriptText = transcriptData.results.transcripts.map(t => t.transcript).join(" ");

      console.log("Transcript:", transcriptText.slice(0, 200));

      // Translate
      const sourceLang = (process.env.SOURCE_LANGUAGE || "en-US").split("-")[0];
      const translations = await translateAll(transcriptText, sourceLang);

      // Build result payload
      const payload = {
        jobName,
        sourceFile: key,
        bucket,
        transcribedAt: new Date().toISOString(),
        sourceLanguage: process.env.SOURCE_LANGUAGE || "en-US",
        transcript: transcriptText,
        translations,
        words: transcriptData.results.items
          .filter(i => i.type === "pronunciation")
          .map(i => ({
            word:       i.alternatives[0].content,
            confidence: parseFloat(i.alternatives[0].confidence),
            start:      parseFloat(i.start_time),
            end:        parseFloat(i.end_time),
          })),
      };

      // Write result to S3
      const resultKey = `results/${jobName}.json`;
      await s3.send(new PutObjectCommand({
        Bucket: RESULTS_BUCKET || bucket,
        Key: resultKey,
        Body: JSON.stringify(payload, null, 2),
        ContentType: "application/json",
      }));

      console.log(`Result written to s3://${RESULTS_BUCKET || bucket}/${resultKey}`);
      results.push({ jobName, resultKey });
    }

    return { statusCode: 200, body: JSON.stringify(results) };
  }

  // ── Branch B: API Gateway GET /result/{jobName} ──────────────
  if (event.httpMethod === "GET" && event.pathParameters?.jobName) {
    const jobName   = event.pathParameters.jobName;
    const bucket    = RESULTS_BUCKET;
    const resultKey = `results/${jobName}.json`;

    try {
      const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: resultKey }));
      const body = await obj.Body.transformToString();
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body,
      };
    } catch (err) {
      if (err.name === "NoSuchKey") {
        return { statusCode: 404, body: JSON.stringify({ error: "Result not found" }) };
      }
      throw err;
    }
  }

  // ── Branch C: API Gateway POST /upload-url ────────────────────
  // Returns a presigned S3 PUT URL so the browser can upload directly.
  if (event.httpMethod === "POST" && event.path === "/upload-url") {
    const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
    const body    = JSON.parse(event.body || "{}");
    const fileExt = (body.filename || "audio.mp3").split(".").pop();
    const key     = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;

    const url = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: RESULTS_BUCKET,
        Key: key,
        ContentType: body.contentType || "audio/mpeg",
      }),
      { expiresIn: 300 }
    );

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ uploadUrl: url, key }),
    };
  }

  return {
    statusCode: 400,
    body: JSON.stringify({ error: "Unrecognised event shape" }),
  };
};
