# DEPLOYMENT.md
## Week 3 URL Shortener — AWS Deployment Guide

Full instructions to go from zero to a live URL shortener on AWS, using **API Gateway + Lambda + DynamoDB** provisioned via **AWS CDK**.

---

## What Gets Provisioned

```
Amazon API Gateway (HTTP v2)
├── POST /shorten       → Lambda: url-shortener-create
└── GET  /r/{token}     → Lambda: url-shortener-redirect

AWS Lambda (Node 20)
├── url-shortener-create   (256 MB, 10s timeout)
└── url-shortener-redirect (128 MB, 5s timeout)

Amazon DynamoDB
└── Table: url-shortener-links
    ├── Partition key: token (String)
    ├── Billing: PAY_PER_REQUEST (on-demand)
    └── TTL attribute: ttl (auto-expires links after 1 year)
```

All resources live in a single CloudFormation stack: `UrlShortenerStack`.

---

## Prerequisites

### 1. AWS Account
Sign up at https://aws.amazon.com — the free tier covers this project comfortably:
- Lambda: 1M free requests/month
- DynamoDB: 25 GB storage, 25 WCU/RCU free
- API Gateway: 1M HTTP API calls/month (first 12 months)

### 2. Install Tools

```bash
# Node.js (v18 or higher)
# Download from https://nodejs.org or use nvm:
nvm install 20 && nvm use 20

# AWS CLI v2
# macOS
brew install awscli

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip && sudo ./aws/install

# Windows
# Download from: https://aws.amazon.com/cli/

# AWS CDK
npm install -g aws-cdk

# Verify
aws --version        # aws-cli/2.x.x
cdk --version        # 2.x.x (build ...)
node --version       # v20.x.x
```

---

## Step 1: Configure AWS Credentials

### Option A — IAM User (simplest for personal accounts)

1. Open the AWS Console → **IAM** → **Users** → **Create user**
2. Attach policy: `AdministratorAccess` (for learning; scope down in production)
3. Go to the user → **Security credentials** → **Create access key** → CLI
4. Copy the Access Key ID and Secret Access Key

```bash
aws configure
# AWS Access Key ID:     AKIA...
# AWS Secret Access Key: xxxxxxxx
# Default region name:   us-east-1
# Default output format: json
```

Verify:
```bash
aws sts get-caller-identity
# Should print your account ID and user ARN
```

### Option B — AWS SSO / IAM Identity Center (recommended for orgs)

```bash
aws configure sso
# Follow prompts: SSO start URL, region, account, role
aws sso login --profile your-profile-name
export AWS_PROFILE=your-profile-name
```

---

## Step 2: Install Lambda Dependencies

Each Lambda function is deployed as a self-contained zip. Install their `node_modules` first:

```bash
cd week3-url-shortener/lambda/create
npm install

cd ../redirect
npm install
```

> The AWS SDK v3 (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`) is bundled in `node_modules` and zipped with the handler. Lambda runtime does include SDK v3, but pinning the version avoids surprises.

---

## Step 3: Bootstrap CDK

CDK needs a one-time setup per AWS account + region to create an S3 bucket and IAM roles it uses internally.

```bash
cd week3-url-shortener/infra
npm install

# Bootstrap (replace with your actual account ID and region)
npx cdk bootstrap aws://YOUR_ACCOUNT_ID/us-east-1

# Or let CDK figure it out automatically:
npx cdk bootstrap
```

You only need to do this once per account/region combination.

---

## Step 4: Deploy the Stack

```bash
cd week3-url-shortener/infra
npx cdk deploy
```

CDK will show a diff of what it's about to create and ask for confirmation. Type `y`.

Expected output (takes ~1-2 minutes):

```
UrlShortenerStack: deploying... [1/1]
UrlShortenerStack: creating CloudFormation changeset...

 ✅  UrlShortenerStack

✨  Deployment time: 62.4s

Outputs:
UrlShortenerStack.ApiEndpoint = https://abc123xyz.execute-api.us-east-1.amazonaws.com
UrlShortenerStack.TableName = url-shortener-links

Stack ARN:
arn:aws:cloudformation:us-east-1:123456789012:stack/UrlShortenerStack/xxxx
```

**Copy the `ApiEndpoint` URL — you'll need it in the next step.**

---

## Step 5: Wire the Frontend

Open `frontend/index.html` and find this line near the top of the `<script>` block:

```js
const API_BASE = (window.API_BASE || "").replace(/\/$/, "");
```

Replace it with your actual endpoint:

```js
const API_BASE = "https://abc123xyz.execute-api.us-east-1.amazonaws.com";
```

Alternatively, serve the frontend with the variable injected (useful for CI/CD):

```html
<!-- Add this BEFORE the main script tag -->
<script>window.API_BASE = "https://abc123xyz.execute-api.us-east-1.amazonaws.com";</script>
```

---

## Step 6: Test the API

### Create a short link

```bash
curl -X POST https://abc123xyz.execute-api.us-east-1.amazonaws.com/shorten \
  -H "Content-Type: application/json" \
  -d '{"longUrl": "https://docs.aws.amazon.com/lambda/latest/dg/welcome.html"}'
```

Expected response:
```json
{
  "shortUrl": "https://abc123xyz.execute-api.us-east-1.amazonaws.com/r/a3f7k2b",
  "token": "a3f7k2b",
  "longUrl": "https://docs.aws.amazon.com/lambda/latest/dg/welcome.html",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

### Create with a custom alias

```bash
curl -X POST https://abc123xyz.execute-api.us-east-1.amazonaws.com/shorten \
  -H "Content-Type: application/json" \
  -d '{"longUrl": "https://github.com", "customToken": "gh"}'
```

### Test the redirect

```bash
curl -v https://abc123xyz.execute-api.us-east-1.amazonaws.com/r/gh
# HTTP/2 301
# location: https://github.com
```

Or just open the short URL in a browser — it should redirect instantly.

### Verify in DynamoDB

```bash
aws dynamodb scan \
  --table-name url-shortener-links \
  --query "Items[*].[token.S, longUrl.S, clicks.N]" \
  --output table
```

---

## Deploying the Frontend

The `frontend/` folder is static HTML + CSS + JS with no build step needed.

### Option A — Open directly (demo / local)

```bash
open frontend/index.html
```

Works in Chrome and Firefox. The demo mode fires automatically when `API_BASE` is not set.

### Option B — S3 Static Website Hosting

```bash
# Create a bucket (name must be globally unique)
aws s3 mb s3://snipdev-frontend-yourname

# Enable static website hosting
aws s3 website s3://snipdev-frontend-yourname \
  --index-document index.html

# Upload
aws s3 sync frontend/ s3://snipdev-frontend-yourname \
  --acl public-read

# Your site is live at:
# http://snipdev-frontend-yourname.s3-website-us-east-1.amazonaws.com
```

### Option C — CloudFront + S3 (HTTPS, CDN)

Add to the CDK stack or provision separately via the console. CloudFront distribution + S3 origin + OAC is the production-grade pattern.

### Option D — Netlify / Vercel (easiest for demos)

```bash
# Netlify CLI
npm install -g netlify-cli
netlify deploy --dir=frontend --prod
```

Set the `API_BASE` env variable in the Netlify dashboard under Site settings → Environment variables, then reference it via a build step or inject it manually into `index.html`.

---

## Stack Management

### View current stack state

```bash
npx cdk diff        # show pending changes
aws cloudformation describe-stacks --stack-name UrlShortenerStack
```

### Update after code changes

```bash
# After editing lambda/ or infra/stack.js:
npx cdk deploy
# CDK will only update changed resources (Lambda code, env vars, etc.)
```

### View Lambda logs

```bash
# Tail live logs
aws logs tail /aws/lambda/url-shortener-create --follow

# Or via CDK shortcut
npx cdk logs url-shortener-create
```

### Tear down everything

```bash
npx cdk destroy
# Confirm with 'y'
```

> The DynamoDB table is set to `RemovalPolicy.RETAIN` — it won't be deleted with the stack. To remove it manually:
> ```bash
> aws dynamodb delete-table --table-name url-shortener-links
> ```

---

## IAM Permissions Reference

The CDK stack auto-creates IAM roles for each Lambda with least-privilege access:

| Lambda | DynamoDB Permissions |
|--------|---------------------|
| `url-shortener-create` | `PutItem`, `GetItem` |
| `url-shortener-redirect` | `GetItem`, `UpdateItem` |

No hardcoded credentials anywhere — Lambdas use their execution role via the instance metadata service.

---

## Environment Variables Set by CDK

| Variable | Value | Used by |
|----------|-------|---------|
| `TABLE_NAME` | `url-shortener-links` | Both Lambdas |
| `BASE_URL` | API Gateway endpoint | Create Lambda |
| `NODE_OPTIONS` | `--enable-source-maps` | Both Lambdas |

---

## Cost Estimate (Free Tier)

| Service | Free Tier | This project (light use) |
|---------|-----------|--------------------------|
| Lambda | 1M requests/month | ~pennies |
| API Gateway | 1M calls/month (12 mo) | Free |
| DynamoDB | 25 WCU + 25 RCU free | Free |
| CloudWatch Logs | 5 GB ingestion | Free |

After free tier: estimated **< $1/month** for low traffic.

---

## Troubleshooting

**`cdk bootstrap` fails with access denied**
→ Your IAM user lacks permissions. Attach `AdministratorAccess` or at minimum `AWSCloudFormationFullAccess` + `IAMFullAccess` + `S3FullAccess`.

**Lambda returns 500 on `/shorten`**
→ Check logs: `aws logs tail /aws/lambda/url-shortener-create --follow`
→ Most common cause: `TABLE_NAME` env var not set (CDK sets it automatically, but check the Lambda config in the console).

**CORS error in the browser**
→ The HTTP API Gateway has CORS configured for `*`. If you see a CORS error, confirm the `OPTIONS` preflight isn't getting blocked by a custom domain or proxy.

**`cdk deploy` says "no changes"**
→ Touch the Lambda file to force a new asset hash: `touch lambda/create/index.js && cdk deploy`

**DynamoDB `ConditionalCheckFailedException` on custom token**
→ Expected — means the token is already taken. The Lambda returns a `409` with a clear message to the frontend.
