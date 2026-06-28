# Deployment Guide — voicescript on AWS

> **Week 5 · Managed AI/ML Cloud Services**
> **Stack**: S3 (storage + trigger) → Lambda (orchestrator) → Amazon Transcribe (STT) → Amazon Translate → API Gateway (frontend bridge)

---

## Architecture Overview

```
Browser (frontend)
     │
     │  1. POST /upload-url  ──────────────────────────────►  API Gateway
     │                                                              │
     │  2. PUT audio file (presigned URL) ──────────────►  S3 Bucket
     │                                                      │
     │                                         S3 PutObject event
     │                                                      │
     │                                                      ▼
     │                                               Lambda Function
     │                                          ┌──────────────────┐
     │                                          │ 1. Start Transcribe│
     │                                          │ 2. Poll until done │
     │                                          │ 3. Fetch transcript│
     │                                          │ 4. Call Translate  │
     │                                          │ 5. Write result.json to S3│
     │                                          └──────────────────┘
     │
     │  3. GET /result/{jobName}  ────────────────────────►  API Gateway
     │                                                              │
     │                                                      S3 GetObject
     │                                                     (results/*.json)
     │
     ◄── 4. JSON transcript + translations ───────────────────────────
```

---

## Prerequisites

```bash
aws --version        # AWS CLI v2
node --version       # Node.js 18+
zip --version        # for Lambda packaging
```

Configure CLI:
```bash
aws configure
# AWS Access Key ID: ...
# AWS Secret Access Key: ...
# Default region: ap-south-1
# Default output format: json
```

---

## Part 1 — Environment Variables

```bash
export AWS_REGION=ap-south-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export BUCKET_NAME=voicescript-$(echo $AWS_ACCOUNT_ID | tail -c 6)
export LAMBDA_NAME=voicescript-processor
export API_NAME=voicescript-api
export LAMBDA_ROLE=voicescript-lambda-role

echo "Bucket : $BUCKET_NAME"
echo "Account: $AWS_ACCOUNT_ID"
echo "Region : $AWS_REGION"
```

---

## Part 2 — S3 Bucket

The same bucket holds both uploads (audio files) and results (JSON transcripts).

### 2.1 Create bucket

```bash
aws s3api create-bucket \
  --bucket $BUCKET_NAME \
  --region $AWS_REGION \
  --create-bucket-configuration LocationConstraint=$AWS_REGION
```

### 2.2 Block public access (Lambda writes; frontend reads via API only)

```bash
aws s3api put-public-access-block \
  --bucket $BUCKET_NAME \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,\
BlockPublicPolicy=true,RestrictPublicBuckets=true
```

### 2.3 CORS (for presigned URL uploads from the browser)

```bash
cat > /tmp/cors.json << 'EOF'
{
  "CORSRules": [{
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedOrigins": ["*"],
    "MaxAgeSeconds": 3000
  }]
}
EOF

aws s3api put-bucket-cors \
  --bucket $BUCKET_NAME \
  --cors-configuration file:///tmp/cors.json
```

### 2.4 Lifecycle rule — auto-delete audio uploads after 7 days

```bash
cat > /tmp/lifecycle.json << 'EOF'
{
  "Rules": [{
    "ID": "delete-uploads",
    "Status": "Enabled",
    "Filter": { "Prefix": "uploads/" },
    "Expiration": { "Days": 7 }
  }]
}
EOF

aws s3api put-bucket-lifecycle-configuration \
  --bucket $BUCKET_NAME \
  --lifecycle-configuration file:///tmp/lifecycle.json
```

---

## Part 3 — IAM Role for Lambda

Lambda needs permissions to: read/write S3, start Transcribe jobs, call Translate, write CloudWatch logs.

### 3.1 Trust policy

```bash
cat > /tmp/lambda-trust.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "lambda.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
EOF

aws iam create-role \
  --role-name $LAMBDA_ROLE \
  --assume-role-policy-document file:///tmp/lambda-trust.json
```

### 3.2 Attach AWS managed policies

```bash
# Basic execution (CloudWatch Logs)
aws iam attach-role-policy \
  --role-name $LAMBDA_ROLE \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Amazon Transcribe full access
aws iam attach-role-policy \
  --role-name $LAMBDA_ROLE \
  --policy-arn arn:aws:iam::aws:policy/AmazonTranscribeFullAccess

# Amazon Translate full access
aws iam attach-role-policy \
  --role-name $LAMBDA_ROLE \
  --policy-arn arn:aws:iam::aws:policy/TranslateFullAccess
```

### 3.3 Inline S3 policy (scoped to our bucket)

```bash
cat > /tmp/s3-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject"
    ],
    "Resource": "arn:aws:s3:::${BUCKET_NAME}/*"
  }, {
    "Effect": "Allow",
    "Action": "s3:ListBucket",
    "Resource": "arn:aws:s3:::${BUCKET_NAME}"
  }]
}
EOF

aws iam put-role-policy \
  --role-name $LAMBDA_ROLE \
  --policy-name voicescript-s3-access \
  --policy-document file:///tmp/s3-policy.json
```

Allow a few seconds for IAM to propagate:
```bash
sleep 10
```

---

## Part 4 — Lambda Function

### 4.1 Package the Lambda code

```bash
cd week5-ai-transcriber/lambda
npm install --omit=dev

zip -r /tmp/voicescript-lambda.zip . \
  --exclude "*.test.js" --exclude "*.md"

cd ../..
echo "Package size: $(du -sh /tmp/voicescript-lambda.zip | cut -f1)"
```

### 4.2 Deploy Lambda

```bash
export LAMBDA_ROLE_ARN=arn:aws:iam::${AWS_ACCOUNT_ID}:role/${LAMBDA_ROLE}

aws lambda create-function \
  --function-name $LAMBDA_NAME \
  --runtime nodejs20.x \
  --handler index.handler \
  --zip-file fileb:///tmp/voicescript-lambda.zip \
  --role $LAMBDA_ROLE_ARN \
  --timeout 600 \
  --memory-size 512 \
  --environment "Variables={
    RESULTS_BUCKET=$BUCKET_NAME,
    TARGET_LANGUAGES=hi,fr,es,de,ja,zh,ar,pt,
    SOURCE_LANGUAGE=en-US,
    AWS_ACCOUNT_ID_PARAM=$AWS_ACCOUNT_ID
  }" \
  --region $AWS_REGION
```

> **Timeout**: 600 seconds (10 min). Transcribe jobs for typical clips (< 5 min) usually complete in 1–3 min. Lambda's max is 900 s.

### 4.3 Configure CloudWatch Logs

```bash
aws logs create-log-group \
  --log-group-name /aws/lambda/$LAMBDA_NAME \
  --region $AWS_REGION

aws logs put-retention-policy \
  --log-group-name /aws/lambda/$LAMBDA_NAME \
  --retention-in-days 14 \
  --region $AWS_REGION
```

---

## Part 5 — S3 Event Trigger

Tell S3 to invoke Lambda when an object is created under `uploads/`.

### 5.1 Grant S3 permission to invoke Lambda

```bash
aws lambda add-permission \
  --function-name $LAMBDA_NAME \
  --statement-id s3-invoke \
  --action lambda:InvokeFunction \
  --principal s3.amazonaws.com \
  --source-arn arn:aws:s3:::${BUCKET_NAME} \
  --source-account $AWS_ACCOUNT_ID \
  --region $AWS_REGION
```

### 5.2 Attach notification to bucket

```bash
export LAMBDA_ARN=arn:aws:lambda:${AWS_REGION}:${AWS_ACCOUNT_ID}:function:${LAMBDA_NAME}

cat > /tmp/notification.json << EOF
{
  "LambdaFunctionConfigurations": [{
    "LambdaFunctionArn": "${LAMBDA_ARN}",
    "Events": ["s3:ObjectCreated:*"],
    "Filter": {
      "Key": {
        "FilterRules": [{
          "Name": "prefix",
          "Value": "uploads/"
        }]
      }
    }
  }]
}
EOF

aws s3api put-bucket-notification-configuration \
  --bucket $BUCKET_NAME \
  --notification-configuration file:///tmp/notification.json
```

Verify:
```bash
aws s3api get-bucket-notification-configuration --bucket $BUCKET_NAME
```

---

## Part 6 — API Gateway (HTTP API)

API Gateway gives the frontend two endpoints:
- `POST /upload-url` — Lambda returns a presigned S3 PUT URL
- `GET /result/{jobName}` — Lambda reads the result JSON from S3

### 6.1 Create HTTP API

```bash
export API_ID=$(aws apigatewayv2 create-api \
  --name $API_NAME \
  --protocol-type HTTP \
  --cors-configuration \
    AllowOrigins='["*"]',AllowMethods='["GET","POST","OPTIONS"]',AllowHeaders='["*"]' \
  --region $AWS_REGION \
  --query "ApiId" --output text)

echo "API ID: $API_ID"
```

### 6.2 Lambda integration

```bash
export INTEGRATION_ID=$(aws apigatewayv2 create-integration \
  --api-id $API_ID \
  --integration-type AWS_PROXY \
  --integration-uri $LAMBDA_ARN \
  --payload-format-version "2.0" \
  --region $AWS_REGION \
  --query "IntegrationId" --output text)
```

### 6.3 Routes

```bash
# POST /upload-url
aws apigatewayv2 create-route \
  --api-id $API_ID \
  --route-key "POST /upload-url" \
  --target integrations/$INTEGRATION_ID \
  --region $AWS_REGION

# GET /result/{jobName}
aws apigatewayv2 create-route \
  --api-id $API_ID \
  --route-key "GET /result/{jobName}" \
  --target integrations/$INTEGRATION_ID \
  --region $AWS_REGION
```

### 6.4 Deploy (auto stage)

```bash
aws apigatewayv2 create-stage \
  --api-id $API_ID \
  --stage-name prod \
  --auto-deploy \
  --region $AWS_REGION

export API_URL=https://${API_ID}.execute-api.${AWS_REGION}.amazonaws.com/prod
echo "API URL: $API_URL"
```

### 6.5 Grant API Gateway permission to invoke Lambda

```bash
aws lambda add-permission \
  --function-name $LAMBDA_NAME \
  --statement-id apigw-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${AWS_REGION}:${AWS_ACCOUNT_ID}:${API_ID}/*" \
  --region $AWS_REGION
```

---

## Part 7 — Frontend Deployment (S3 Static Website)

### 7.1 Create a separate public bucket for the frontend

```bash
export FRONTEND_BUCKET=voicescript-frontend-$(echo $AWS_ACCOUNT_ID | tail -c 6)

aws s3api create-bucket \
  --bucket $FRONTEND_BUCKET \
  --region $AWS_REGION \
  --create-bucket-configuration LocationConstraint=$AWS_REGION

# Allow public read
aws s3api put-public-access-block \
  --bucket $FRONTEND_BUCKET \
  --public-access-block-configuration \
    BlockPublicAcls=false,IgnorePublicAcls=false,\
BlockPublicPolicy=false,RestrictPublicBuckets=false

cat > /tmp/public-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::${FRONTEND_BUCKET}/*"
  }]
}
EOF

aws s3api put-bucket-policy \
  --bucket $FRONTEND_BUCKET \
  --policy file:///tmp/public-policy.json

aws s3 website s3://${FRONTEND_BUCKET} \
  --index-document index.html \
  --error-document index.html
```

### 7.2 Upload frontend files

```bash
aws s3 cp week5-ai-transcriber/src/index.html s3://${FRONTEND_BUCKET}/index.html \
  --content-type "text/html"

aws s3 cp week5-ai-transcriber/src/style.css s3://${FRONTEND_BUCKET}/style.css \
  --content-type "text/css"
```

### 7.3 Access URL

```bash
echo "Frontend: http://${FRONTEND_BUCKET}.s3-website.${AWS_REGION}.amazonaws.com"
echo "API URL to paste into the config panel: $API_URL"
```

---

## Part 8 — Test the Full Pipeline

### 8.1 End-to-end via CLI

```bash
# Upload a test audio file
aws s3 cp /path/to/test.mp3 s3://${BUCKET_NAME}/uploads/test.mp3

# Watch Lambda logs
aws logs tail /aws/lambda/$LAMBDA_NAME --follow
```

### 8.2 Check results

```bash
# List result files
aws s3 ls s3://${BUCKET_NAME}/results/

# Read a specific result
aws s3 cp s3://${BUCKET_NAME}/results/<jobName>.json /tmp/result.json
cat /tmp/result.json | python3 -m json.tool
```

### 8.3 Via the frontend

1. Open the frontend URL
2. Expand "AWS endpoint configuration"
3. Paste in your `$API_URL`
4. Drop an audio file
5. Watch the pipeline progress

---

## Part 9 — Supported Languages

| Transcribe code | Language            | Translate code |
|-----------------|---------------------|----------------|
| `en-US`         | English (US)        | `en`           |
| `en-GB`         | English (UK)        | `en`           |
| `hi-IN`         | Hindi               | `hi`           |
| `fr-FR`         | French              | `fr`           |
| `de-DE`         | German              | `de`           |
| `es-ES`         | Spanish             | `es`           |
| `ja-JP`         | Japanese            | `ja`           |
| `zh-CN`         | Chinese (Mandarin)  | `zh`           |
| `ar-SA`         | Arabic              | `ar`           |
| `pt-BR`         | Portuguese (BR)     | `pt`           |

Change `SOURCE_LANGUAGE` env var on Lambda to switch the input language.

---

## Part 10 — Update Lambda Code

When you change `lambda/index.js`:

```bash
cd week5-ai-transcriber/lambda
npm install --omit=dev
zip -r /tmp/voicescript-lambda.zip .
cd ../..

aws lambda update-function-code \
  --function-name $LAMBDA_NAME \
  --zip-file fileb:///tmp/voicescript-lambda.zip \
  --region $AWS_REGION
```

---

## Part 11 — Cost Estimate (low-volume)

| Service             | Free tier                        | Beyond free tier           |
|---------------------|----------------------------------|----------------------------|
| Amazon Transcribe   | 60 min/month for 12 months       | ~$0.024 / min              |
| Amazon Translate    | 2M chars/month for 12 months     | ~$15 / 1M chars            |
| AWS Lambda          | 1M requests + 400K GB-s/month    | ~$0.20 / 1M requests       |
| Amazon S3           | 5 GB storage + 20K GET           | ~$0.023 / GB               |
| API Gateway (HTTP)  | 1M requests/month for 12 months  | ~$1 / 1M requests          |

A typical 3-minute audio file in English → Hindi + French ≈ **$0.10** in production.

---

## Part 12 — Teardown

```bash
# Remove S3 notifications
aws s3api put-bucket-notification-configuration \
  --bucket $BUCKET_NAME \
  --notification-configuration '{}'

# Delete Lambda
aws lambda delete-function --function-name $LAMBDA_NAME --region $AWS_REGION

# Delete API Gateway
aws apigatewayv2 delete-api --api-id $API_ID --region $AWS_REGION

# Empty and delete audio bucket
aws s3 rm s3://${BUCKET_NAME} --recursive
aws s3api delete-bucket --bucket $BUCKET_NAME --region $AWS_REGION

# Empty and delete frontend bucket
aws s3 rm s3://${FRONTEND_BUCKET} --recursive
aws s3api delete-bucket --bucket $FRONTEND_BUCKET --region $AWS_REGION

# Delete IAM role
aws iam detach-role-policy --role-name $LAMBDA_ROLE \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam detach-role-policy --role-name $LAMBDA_ROLE \
  --policy-arn arn:aws:iam::aws:policy/AmazonTranscribeFullAccess
aws iam detach-role-policy --role-name $LAMBDA_ROLE \
  --policy-arn arn:aws:iam::aws:policy/TranslateFullAccess
aws iam delete-role-policy --role-name $LAMBDA_ROLE --policy-name voicescript-s3-access
aws iam delete-role --role-name $LAMBDA_ROLE

# Delete log group
aws logs delete-log-group \
  --log-group-name /aws/lambda/$LAMBDA_NAME --region $AWS_REGION

# Clean temp files
rm -f /tmp/cors.json /tmp/lifecycle.json /tmp/lambda-trust.json \
       /tmp/s3-policy.json /tmp/notification.json /tmp/public-policy.json \
       /tmp/voicescript-lambda.zip
```

---

## Concept Summary

| Concept | Role in this project |
|---|---|
| **S3 PutObject event** | The pipeline trigger — object creation fires Lambda automatically |
| **Lambda** | Stateless orchestrator: starts jobs, polls, writes results |
| **Amazon Transcribe** | Managed STT — no model to host or fine-tune; pays per minute |
| **Amazon Translate** | Neural MT across 75+ languages; pays per character |
| **API Gateway HTTP API** | Bridges browser ↔ Lambda; issues presigned URLs for direct S3 upload |
| **Presigned URL** | Browser uploads directly to S3 without routing audio through Lambda |
| **Polling** | Frontend polls `GET /result/{jobName}` every 5 s; Lambda writes result when done |
| **Event-driven** | No server constantly running — each stage wakes only when needed |
