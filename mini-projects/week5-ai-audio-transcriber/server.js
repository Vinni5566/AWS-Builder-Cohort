/**
 * week5-ai-transcriber — static file server
 *
 * Serves index.html + style.css for local development.
 * In production the frontend is deployed to S3 static website hosting
 * or CloudFront — no server needed.
 */

const http = require("http");
const fs   = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "application/javascript",
  ".ico":  "image/x-icon",
};

const server = http.createServer((req, res) => {
  let url = req.url === "/" ? "/index.html" : req.url;

  // Strip query string
  url = url.split("?")[0];

  const filePath    = path.join(__dirname, url);
  const ext         = path.extname(filePath);
  const contentType = MIME[ext] || "text/plain";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`[voicescript] dev server → http://localhost:${PORT}`);
  console.log(`[voicescript] Drop an audio file to test the demo UI.`);
  console.log(`[voicescript] Configure API Gateway URL in the panel for live AWS.`);
});
