# week5-ai-transcriber

> Week 5 · Managed AI/ML Cloud Services

An audio drop-zone application that returns live transcripts and translations — powered entirely by AWS managed AI services.

## Stack

- **Frontend**: Vanilla JS, Instrument Serif + Inter, warm editorial design
- **Orchestrator**: AWS Lambda (Node.js 20)
- **Storage + Trigger**: Amazon S3 (PutObject event → Lambda)
- **Speech-to-Text**: Amazon Transcribe
- **Translation**: Amazon Translate (8 target languages)
- **API**: Amazon API Gateway (HTTP API, presigned URL pattern)

## Features

- Drag-and-drop or click-to-upload audio (MP3, WAV, FLAC, M4A, OGG, WEBM)
- Animated waveform during processing (the signature UI element)
- Word-level confidence colouring (high / medium / low)
- 8 toggle-able target languages
- Demo mode with mock data when no AWS endpoint is configured
- Copy-to-clipboard on transcripts

## Local Development

```bash
npm install
npm start        # http://localhost:3000
npm run dev      # nodemon auto-reload
```

Open the app, drop any audio file — it runs in **demo mode** (mock data, no AWS needed) until you configure an API Gateway URL in the panel.

## Project Structure

```
week5-ai-transcriber/
├── src/
│   ├── server.js     ← Dev static file server
│   ├── index.html    ← Drop-zone UI (links style.css)
│   └── style.css     ← All styles, separated
├── lambda/
│   ├── index.js      ← Lambda handler (S3 → Transcribe → Translate)
│   └── package.json  ← AWS SDK v3 deps
├── package.json
├── README.md
└── DEPLOYMENT.md     ← Full AWS deployment guide (Parts 1–12)
```

## Pipeline

```
Drop audio → S3 upload (presigned URL)
           → S3 PutObject event fires Lambda
           → Lambda starts Transcribe job
           → Lambda polls until complete
           → Lambda calls Translate for each language
           → Lambda writes result JSON to S3
           → Frontend polls GET /result/{jobName}
           → Transcript + translations rendered
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) — covers S3 setup, IAM, Lambda packaging, S3 event trigger, API Gateway routes, frontend hosting, cost estimate, and teardown.
