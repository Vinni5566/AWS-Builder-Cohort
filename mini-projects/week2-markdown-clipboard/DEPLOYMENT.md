# Deployment Guide - AWS S3 + CloudFront

## Prerequisites

- AWS CLI installed and configured
- AWS account with appropriate permissions

## Step 1: Create S3 Bucket

```bash
aws s3 mb s3://your-unique-bucket-name
```

Replace `your-unique-bucket-name` with a globally unique name.

## Step 2: Enable Static Website Hosting

```bash
aws s3 website s3://your-unique-bucket-name --index-document index.html
```

## Step 3: Set Bucket Policy for Public Access

Create a file named `bucket-policy.json`:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::your-unique-bucket-name/*"
        }
    ]
}
```

Apply the policy:

```bash
aws s3api put-bucket-policy --bucket your-unique-bucket-name --policy file://bucket-policy.json
```

## Step 4: Upload Files to S3

```bash
aws s3 sync . s3://your-unique-bucket-name --acl public-read
```

## Step 5: Create CloudFront Distribution

### Option A: Using AWS Console

1. Go to CloudFront in AWS Console
2. Click "Create Distribution"
3. Select "Origin Domain" as your S3 bucket endpoint
4. Set "Viewer Protocol Policy" to "Redirect HTTP to HTTPS"
5. Set "Default Root Object" to `index.html`
6. Create distribution

### Option B: Using AWS CLI

Create a file named `cloudfront-config.json`:

```json
{
    "CallerReference": "markdown-clipboard-2024",
    "Origins": {
        "Quantity": 1,
        "Items": [
            {
                "Id": "S3-your-unique-bucket-name",
                "DomainName": "your-unique-bucket-name.s3-website-us-east-1.amazonaws.com",
                "CustomOriginConfig": {
                    "HTTPPort": 80,
                    "HTTPSPort": 443,
                    "OriginProtocolPolicy": "http-only"
                }
            }
        ]
    },
    "DefaultCacheBehavior": {
        "TargetOriginId": "S3-your-unique-bucket-name",
        "ViewerProtocolPolicy": "redirect-to-https",
        "MinTTL": 0,
        "ForwardedValues": {
            "QueryString": false,
            "Cookies": {
                "Forward": "none"
            }
        }
    },
    "Comment": "Markdown Clipboard Distribution",
    "Enabled": true,
    "DefaultRootObject": "index.html"
}
```

Create the distribution:

```bash
aws cloudfront create-distribution --distribution-config file://cloudfront-config.json
```

## Step 6: Access Your Application

After CloudFront distribution is deployed (takes 10-15 minutes), access your app at:

```
https://xxxx.cloudfront.net
```

## Step 7: Update Files (Optional)

To update your application after changes:

```bash
aws s3 sync . s3://your-unique-bucket-name --acl public-read
```

Then invalidate CloudFront cache:

```bash
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
```

## Cleanup

To delete resources:

```bash
# Empty S3 bucket
aws s3 rm s3://your-unique-bucket-name --recursive

# Delete S3 bucket
aws s3 rb s3://your-unique-bucket-name

# Disable CloudFront distribution first, then delete
aws cloudfront delete-distribution --id YOUR_DISTRIBUTION_ID
```
