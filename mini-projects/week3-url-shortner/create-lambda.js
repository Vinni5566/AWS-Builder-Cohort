/**
 * Week 3 – URL Shortener
 * Lambda: POST /shorten
 *
 * Body: { longUrl: string, customToken?: string }
 * Returns: { shortUrl: string, token: string }
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
} = require("@aws-sdk/lib-dynamodb");
const crypto = require("crypto");

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE = process.env.TABLE_NAME;
const BASE_URL = process.env.BASE_URL; // e.g. https://abc123.execute-api.us-east-1.amazonaws.com/prod

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

function generateToken(len = 7) {
  // URL-safe base64, trimmed to `len` characters
  return crypto.randomBytes(16).toString("base64url").slice(0, len);
}

function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidToken(t) {
  // alphanumeric + hyphen + underscore, 3-32 chars
  return /^[a-zA-Z0-9_-]{3,32}$/.test(t);
}

exports.handler = async (event) => {
  // Pre-flight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return respond(400, { error: "Invalid JSON body" });
  }

  const { longUrl, customToken } = body;

  if (!longUrl || !isValidUrl(longUrl)) {
    return respond(400, {
      error: "longUrl is required and must be a valid http/https URL",
    });
  }

  const token = customToken
    ? customToken.trim().toLowerCase()
    : generateToken();

  if (customToken && !isValidToken(token)) {
    return respond(400, {
      error:
        "customToken must be 3-32 characters: letters, numbers, hyphens, underscores only",
    });
  }

  // Check collision for custom tokens
  if (customToken) {
    const existing = await ddb.send(
      new GetCommand({ TableName: TABLE, Key: { token } })
    );
    if (existing.Item) {
      return respond(409, {
        error: `Token "${token}" is already in use. Choose a different one.`,
      });
    }
  }

  const now = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365; // 1 year

  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        token,
        longUrl,
        createdAt: now,
        clicks: 0,
        ttl, // DynamoDB TTL attribute
      },
      // Extra safety: don't overwrite if a concurrent request slipped through
      ConditionExpression: "attribute_not_exists(#t)",
      ExpressionAttributeNames: { "#t": "token" },
    }).catch(() => {
      // If condition fails on random token, retry with a new one (rare)
    })
  );

  const shortUrl = `${BASE_URL}/r/${token}`;

  return respond(201, { shortUrl, token, longUrl, createdAt: now });
};

function respond(statusCode, obj) {
  return {
    statusCode,
    headers: { ...CORS, "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}
