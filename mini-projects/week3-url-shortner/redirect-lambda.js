/**
 * Week 3 – URL Shortener
 * Lambda: GET /r/{token}
 *
 * Looks up the token in DynamoDB and issues a 301 redirect.
 * Also increments a click counter (fire-and-forget, non-blocking).
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE = process.env.TABLE_NAME;

exports.handler = async (event) => {
  const token =
    event.pathParameters?.token ||
    (event.path || "").split("/").filter(Boolean).pop();

  if (!token) {
    return notFound();
  }

  let item;
  try {
    const result = await ddb.send(
      new GetCommand({ TableName: TABLE, Key: { token } })
    );
    item = result.Item;
  } catch (err) {
    console.error("DDB GetItem error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain" },
      body: "Internal server error",
    };
  }

  if (!item) {
    return notFound(token);
  }

  // Fire-and-forget click increment — don't await so redirect is instant
  ddb
    .send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { token },
        UpdateExpression: "SET clicks = clicks + :inc",
        ExpressionAttributeValues: { ":inc": 1 },
      })
    )
    .catch((e) => console.warn("Click increment failed:", e.message));

  return {
    statusCode: 301,
    headers: {
      Location: item.longUrl,
      "Cache-Control": "no-cache, no-store",
    },
    body: "",
  };
};

function notFound(token = "") {
  const msg = token
    ? `No URL found for token: ${token}`
    : "Token is missing from the request path";
  return {
    statusCode: 404,
    headers: { "Content-Type": "text/html" },
    body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Link not found</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; flex-direction: column;
           align-items: center; justify-content: center; height: 100vh; margin: 0;
           background: #0f1117; color: #e2e8f0; }
    h1  { font-size: 3rem; margin-bottom: 0.25rem; }
    p   { color: #94a3b8; }
    a   { color: #6ee7f7; }
  </style>
</head>
<body>
  <h1>404</h1>
  <p>${msg}</p>
  <p><a href="/">Create a new short link →</a></p>
</body>
</html>`,
  };
}
