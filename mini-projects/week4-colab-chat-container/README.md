# week4-collab-chat

> Week 4 · Managed Containers & Microservices

A live WebSocket multi-room terminal chat for remote engineering teams.

## Stack

- **Runtime**: Node.js 20 + `ws` library (zero framework overhead)
- **Frontend**: Vanilla JS, JetBrains Mono, GitHub-dark terminal aesthetic
- **Containerization**: Docker (multi-stage build, non-root user)
- **Registry**: Amazon ECR
- **Compute**: Amazon ECS on AWS Fargate (serverless)

## Features

- 4 pre-configured rooms: `#general`, `#engineering`, `#devops`, `#random`
- Real-time room switching with live user presence
- Per-user color assignment + avatar initials
- Typing indicators with 3-dot animation
- System messages on join / leave / room switch
- Flash animation on new message receive
- Message flash on receive, phosphor-style
- Health check endpoint for ECS/ALB

## Local Development

```bash
npm install
npm start          # http://localhost:3000
npm run dev        # with nodemon auto-reload
```

## Docker

```bash
docker build -t collab-chat .
docker run -p 3000:3000 collab-chat
```

## Project Structure

```
week4-collab-chat/
├── src/
│   ├── server.js     ← WebSocket + HTTP server
│   ├── index.html    ← UI (pulls in style.css)
│   └── style.css     ← All styles (separated from HTML)
├── Dockerfile
├── .dockerignore
├── .gitignore
├── package.json
├── README.md
└── DEPLOYMENT.md     ← Full AWS ECR + ECS Fargate deployment guide
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full step-by-step guide covering:
ECR setup → IAM roles → VPC/SGs → ECS cluster → Task definition → ALB → Service → Auto scaling → Teardown.
