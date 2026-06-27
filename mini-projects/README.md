# AWS Summer Builder Cohort 2026 🚀

Welcome to our active development repository for the **AWS Summer Builder Cohort 2026** hosted by the AWS Student Builder Group, IGDTUW. 

This repository serves as a hands-on learning chronicle. Instead of a single static application, it is organized as a modular monorepo containing **mini-projects** engineered to explore different pillars of the Amazon Web Services (AWS) ecosystem—ranging from global edge networking and serverless computing to containerization and managed AI.

---

## 🗺️ Project Roadmap & AWS Tech Stack

Every folder in this repository represents an independent, fully deployable project aligned with the cohort's weekly learning sprints.

| Week | Project Module | Core AWS Services Used | Deployment Status |
| :--- | :--- | :--- | :--- |
| **Week 1** | [Cloud Builder Terminal Dashboard](./week1-terminal-dashboard) | AWS Amplify Hosting, IAM | 🔗 |
| **Week 2** | [Developer's Markdown Clipboard](./week2-markdown-clipboard) | Amazon S3, Amazon CloudFront | https://markdown-clip.netlify.app/ |
| **Week 3** | [Smart Serverless URL Shortener](./week3-url-shortener) | AWS Lambda, API Gateway, DynamoDB | 🔗|
| **Week 4** | [Real-Time Collab Chat Container](./week4-collab-chat) | Amazon ECS, AWS Fargate, Amazon ECR | 🔗 |
| **Week 5** | [Multilingual AI Audio Transcriber](./week5-ai-transcriber) | Amazon Transcribe, Amazon Translate, S3, Lambda | 🔗 |
| **Week 6** | [Automated Cloud Health Alert Bot](./week6-cloud-health-bot) | Amazon EventBridge, AWS Lambda, Amazon SNS | 🔗 |

---

## 📁 Directory Breakdown

### 🛠️ Week 1: Foundational Cloud Hosting
*   **Directory:** `/week1-terminal-dashboard`
*   **Concept:** Foundational Git workflows, IAM user configuration, and basic cloud asset hosting.
*   **Project:** A minimalist, terminal-themed web dashboard acting as the central hub and index linking to all subsequent weekly deployments.
*   **Infrastructure:** Deployed via **AWS Amplify** utilizing continuous deployment pipelines triggered straight from GitHub.

### 🌐 Week 2: Content Delivery & Edge Caching
*   **Directory:** `/week2-markdown-clipboard`
*   **Concept:** Cloud storage architecture, access policies, global edge caching, and SSL enforcement.
*   **Project:** A lightweight static markdown clipboard text previewer.
*   **Infrastructure:** Hosted on **Amazon S3** (configured for static website hosting) and accelerated globally via an **Amazon CloudFront** distribution.

### ⚡ Week 3: Serverless Compute & Managed Databases
*   **Directory:** `/week3-url-shortener`
*   **Concept:** Serverless computing models, restful API management, and NoSQL key-value lookups.
*   **Project:** A functional URL shortener that maps custom tokens to long URLs.
*   **Infrastructure:** Single-page app interacting with **Amazon API Gateway**, executing compute tasks via **AWS Lambda**, and persisting data inside **Amazon DynamoDB**.

### 🐳 Week 4: Managed Containers & Microservices
*   **Directory:** `/week4-collab-chat`
*   **Concept:** Docker containerization, registry management, and serverless container orchestration.
*   **Project:** A live WebSocket multi-room terminal chat for remote engineering teams.
*   **Infrastructure:** A Node.js container image pushed to **Amazon ECR (Elastic Container Registry)** and executed serverlessly on **Amazon ECS (Elastic Container Service) using AWS Fargate**.

### 🧠 Week 5: Managed AI/ML Cloud Services
*   **Directory:** `/week5-ai-transcriber`
*   **Concept:** Event-driven architecture pipeline triggered via object mutations connected to pre-trained cloud AI models.
*   **Project:** An audio drop-zone application returning live transcripts and translations.
*   **Infrastructure:** Audio drops into **Amazon S3**, which invokes an event trigger to **AWS Lambda**. The function calls **Amazon Transcribe** for speech-to-text conversion and passes the payload to **Amazon Translate**.

### 🚨 Week 6: Event-Driven Automation & System Alerts
*   **Directory:** `/week6-cloud-health-bot`
*   **Concept:** Cloud monitoring cron jobs and Pub/Sub (Publish/Subscribe) messaging systems.
*   **Project:** A background system monitor that periodically pings prior deployments, updates a public status page, and shoots SMS/email logs out if latency drops.
*   **Infrastructure:** **Amazon EventBridge** rules execute an **AWS Lambda** script at regular intervals. Failures are handled and dispatched instantly via **Amazon SNS (Simple Notification Service)**.

---

⚖️ License & Guidelines
This code is written under the rules and guidelines of the AWS Summer Builder Cohort 2026. Plagiarism or uncredited code copying is strictly prohibited. All setups have been developed from scratch for learning purposes.
