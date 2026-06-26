# The Developer's Markdown Clipboard

A fast, single-page static web app for writing, previewing, and downloading Markdown.

## Features

- Write or paste Markdown text
- Instant HTML preview
- Download as .md file
- Export as HTML file
- Copy HTML to clipboard
- Dark/Light mode toggle
- Auto-save to localStorage
- Real-time word/character/line count
- Client-side only (no backend required)

## Tech Stack

- HTML5, CSS3, Vanilla JavaScript
- AWS S3 (static website hosting)
- AWS CloudFront (CDN + HTTPS)

## Project Structure

```
week2-markdown-clipboard/
├── index.html          # Main HTML structure with editor/preview panels
├── styles.css          # Responsive styling with modern design
├── app.js              # Markdown parser class + live preview + download
├── README.md           # Project overview
├── DEPLOYMENT.md       # Detailed AWS S3 + CloudFront deployment guide
├── example.md          # Sample Markdown file for testing
└── .gitignore          # Git ignore rules for AWS config files
```

## Deployment

### 1. Create S3 Bucket

```bash
aws s3 mb s3://your-bucket-name
```

### 2. Enable Static Website Hosting

```bash
aws s3 website s3://your-bucket-name --index-document index.html
```

### 3. Upload Files

```bash
aws s3 sync . s3://your-bucket-name --acl public-read
```

### 4. Create CloudFront Distribution

Use AWS Console or CLI to create CloudFront distribution pointing to S3 bucket.

### 5. Access

Open your CloudFront domain: `https://xxxx.cloudfront.net`
