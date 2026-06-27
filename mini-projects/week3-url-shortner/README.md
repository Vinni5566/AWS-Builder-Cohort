# Week 3 — URL Shortener
### Serverless Compute · API Gateway · Lambda · DynamoDB

> **Capstone project for the Serverless Compute & Managed Databases week.**
> A production-grade URL shortener built entirely on AWS managed services — zero servers to provision or patch.

---

## Architecture

```
Browser (SPA)
     │
     │  POST /shorten      GET /r/{token}
     ▼                          ▼
┌─────────────────────────────────────────┐
│          Amazon API Gateway (HTTP v2)   │
│   - Managed routing + TLS termination   │
│   - Built-in CORS preflight handling    │
│   - $0 until you get traffic            │
└──────────┬──────────────────┬───────────┘
           │                  │
    ┌──────▼───────┐  ┌───────▼──────┐
    │  Lambda:     │  │  Lambda:     │
    │  create      │  │  redirect    │
    │  Node 20     │  │  Node 20     │
    │  256 MB      │  │  128 MB      │
    └──────┬───────┘  └───────┬──────┘
           │                  │
           └──────┬───────────┘
                  ▼
     ┌────────────────────────┐
     │   Amazon DynamoDB      │
     │   Table: url-shortener │
     │   PK: token (String)   │
     │   Capacity: On-demand  │
     │   TTL: ttl attribute   │
     └────────────────────────┘
```

### DynamoDB Item Schema

```json
{
  "token":     "abc1234",
  "longUrl":   "https://example.com/very/long/path",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "clicks":    42,
  "ttl":       1736928600
}
```

---

## Project Structure

```
week3-url-shortener/
├── frontend/
│   └── index.html          ← Single-page app (zero dependencies)
├── lambda/
│   ├── create/
│   │   ├── index.js        ← POST /shorten handler
│   │   └── package.json
│   └── redirect/
│       ├── index.js        ← GET /r/{token} handler
│       └── package.json
├── infra/
│   ├── stack.js            ← AWS CDK stack (full IaC)
│   ├── cdk.json
│   └── package.json
└── README.md
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 18 | https://nodejs.org |
| AWS CLI | ≥ 2 | `brew install awscli` |
| AWS CDK | ≥ 2 | `npm i -g aws-cdk` |
| AWS Account | — | Free tier works |

Configure AWS credentials:
```bash
aws configure
# Enter: Access Key ID, Secret Access Key, region (e.g. us-east-1), output (json)
```

---

## Deploy in 4 Commands

```bash
# 1. Bootstrap CDK (one-time per account/region)
cd week3-url-shortener/infra
npm install
npx cdk bootstrap

# 2. Deploy the full stack
npx cdk deploy

# 3. Copy the API endpoint from outputs:
#    UrlShortenerStack.ApiEndpoint = https://abc123.execute-api.us-east-1.amazonaws.com

# 4. Wire the frontend
#    Open frontend/index.html and find this line:
#    const API_BASE = (window.API_BASE || "").replace(/\/$/, "");
#    Change it to:
#    const API_BASE = "https://abc123.execute-api.us-east-1.amazonaws.com";
```

That's it — no Dockerfiles, no EC2, no config files outside of CDK.

---

## API Reference

### `POST /shorten`

Create a short link.

**Request body:**
```json
{
  "longUrl": "https://example.com/very/long/url",
  "customToken": "my-link"          // optional
}
```

**Response `201`:**
```json
{
  "shortUrl":  "https://{api}/r/my-link",
  "token":     "my-link",
  "longUrl":   "https://example.com/very/long/url",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

**Error codes:**
| Status | Meaning |
|--------|---------|
| 400 | Invalid URL or token format |
| 409 | Custom token already in use |
| 500 | DynamoDB error |

---

### `GET /r/{token}`

Redirect to the original URL.

- **301 redirect** to `longUrl` on success
- **404 HTML page** if token not found

The redirect Lambda also increments the `clicks` counter as a fire-and-forget write — it doesn't block the response.

---

## Local Development (No AWS)

The frontend includes a **demo mode** that activates when `API_BASE` is empty. It simulates the API locally so you can develop and showcase the UI without deploying anything.

```bash
# Just open the file in a browser — no server needed
open frontend/index.html
```

For a real local backend, you can use the AWS SAM CLI or LocalStack:

```bash
# Option A: SAM local (closest to real Lambda)
sam local start-api --template template.yaml

# Option B: LocalStack (full AWS simulation)
docker run -p 4566:4566 localstack/localstack
aws dynamodb create-table --endpoint-url http://localhost:4566 \
  --table-name url-shortener-links \
  --attribute-definitions AttributeName=token,AttributeType=S \
  --key-schema AttributeName=token,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

---

## Key Concepts This Project Demonstrates

### Serverless Compute Model
Lambda functions are **stateless** — they boot on demand, execute, and shut down. You pay only for the milliseconds they run. The `redirect` function is tuned to 128 MB because it does a single DDB read; the `create` function gets 256 MB for slightly heavier processing.

### Cold Starts
Lambda has a "cold start" penalty the first time a function runs (or after idle). Node.js cold starts are typically 50–200 ms. Mitigations: smaller bundles, Provisioned Concurrency for latency-critical paths.

### NoSQL Key-Value Lookups
DynamoDB's **single-table design** with token as the partition key makes every redirect a direct O(1) lookup — no table scans, no joins. This is why URL shorteners are a textbook DynamoDB use case.

### TTL (Time To Live)
Items have a `ttl` attribute (Unix timestamp). DynamoDB automatically deletes expired items within 48 hours at no extra cost. No cron job or cleanup Lambda needed.

### On-Demand Billing
`PAY_PER_REQUEST` billing means you pay per read/write unit, not for provisioned capacity sitting idle. For low-to-moderate traffic, this is almost always cheaper than provisioned mode.

### API Gateway HTTP API (v2)
HTTP API is the modern, cheaper alternative to REST API. It's ~70% cheaper and has lower latency for Lambda integrations. The trade-off: fewer features (no API keys, no usage plans out of the box).

### Infrastructure as Code (CDK)
The entire infrastructure is defined in ~80 lines of JavaScript. `cdk deploy` provisions everything; `cdk destroy` tears it all down. No clicking through the AWS console, no YAML snowflakes.

---

## Extending This Project

Ideas to level up further:

| Feature | Approach |
|---------|----------|
| Analytics dashboard | Query DynamoDB by `createdAt` GSI; chart clicks per token |
| Custom domain | Route 53 + ACM certificate + API Gateway custom domain |
| Rate limiting | API Gateway usage plans or Lambda-side IP tracking in DDB |
| QR code generation | Client-side with `qrcode.js` library |
| Password-protected links | Store hashed password in DDB, validate in redirect Lambda |
| Link preview (og:image) | Puppeteer Lambda to screenshot the destination |

---

## Teardown

```bash
cd infra
npx cdk destroy
```

> ⚠️ The DynamoDB table uses `RemovalPolicy.RETAIN` so your data survives a stack delete. To fully remove it: `aws dynamodb delete-table --table-name url-shortener-links`

---

*Week 3 of the Serverless Compute & Managed Databases module.*
