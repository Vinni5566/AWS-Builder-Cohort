# Week 1 — Terminal Dashboard
### Foundational Git Workflows · IAM Configuration · AWS Amplify Hosting

> **Capstone project hub.** A minimalist terminal-themed dashboard that acts as the central index for all weekly cloud deployments — itself deployed via AWS Amplify with continuous deployment from GitHub.

---

## What This Is

A single-page static site styled as a Unix terminal window. It runs `ls -la` on the `~/cloud-projects` directory, listing each weekly project as a filesystem entry — with permissions, size, date, and a clickable filename that links to the live deployment.

The page boots with a short init sequence, then reveals the project listing with a blinking cursor prompt.

## What It Demonstrates

- **IAM best practices:** deployer user with scoped permissions, never using root credentials
- **Git workflow:** feature branches, conventional commits, PR-based merges to `main`
- **Amplify CI/CD:** `amplify.yml` build spec, GitHub webhook triggers, automatic TLS
- **Static hosting:** no servers, no S3 configuration, no CloudFront wiring — Amplify manages it all

## File Structure

```
week1-terminal-dashboard/
├── index.html      ← markup
├── styles.css      ← design tokens, layout, animations
├── app.js          ← boot sequence, uptime clock
├── amplify.yml     ← build + deploy config
├── DEPLOYMENT.md   ← full AWS setup guide
└── README.md       ← this file
```

## Local Preview

No build step. Open directly:

```bash
open index.html
# or
python3 -m http.server 8080   # then visit localhost:8080
```

## Deploy

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the complete step-by-step guide:
IAM user creation → GitHub repo setup → Amplify connection → custom domain.

## Updating Project Links

As weekly projects go live, update `index.html`:

1. Find the relevant `project-row`
2. Set `href` to the live URL
3. Remove the `pending` class
4. Change `<span class="badge soon">` to `<span class="badge live">`
5. Commit and push — Amplify redeploys automatically

---

*Week 1 of the Serverless Compute & Cloud Infrastructure capstone series.*
