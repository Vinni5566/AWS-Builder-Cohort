# DEPLOYMENT.md
## Week 1 Terminal Dashboard — AWS Amplify Deployment Guide

Full setup from a blank AWS account to a live, auto-deploying static site on **AWS Amplify**, triggered directly from **GitHub**.

---

## What Gets Provisioned

```
GitHub Repository
└── main branch push
        │
        ▼  (webhook)
AWS Amplify App
├── Build: reads amplify.yml
├── Deploy: serves index.html + styles.css + app.js
├── Hosting: managed CDN (CloudFront under the hood)
├── HTTPS: auto-provisioned TLS cert (ACM)
└── URL: https://main.XXXXXXXX.amplifyapp.com
```

No servers, no S3 buckets to configure manually, no CloudFront distribution to wire up — Amplify handles all of it.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Git | ≥ 2.x | https://git-scm.com |
| GitHub account | — | https://github.com |
| AWS account | — | https://aws.amazon.com (free tier works) |
| AWS CLI | ≥ 2.x | `brew install awscli` or see below |

---

## Step 1: Create an IAM User for Deployments

Never use your root AWS account for day-to-day work. Create a dedicated IAM user.

### Via AWS Console

1. Open **IAM** → **Users** → **Create user**
2. Username: `cloud-lab-deployer`
3. Select: **Attach policies directly**
4. Attach: `AdministratorAccess` *(scope down to `AmplifyBackendDeployFullAccess` for production)*
5. Finish → **Security credentials** tab → **Create access key** → **CLI**
6. Download the CSV or copy the keys immediately (shown only once)

### Configure the CLI

```bash
aws configure --profile cloud-lab
# AWS Access Key ID:     AKIA...
# AWS Secret Access Key: xxxxxxxx
# Default region name:   us-east-1
# Default output format: json

# Verify
aws sts get-caller-identity --profile cloud-lab
```

Set it as default for this session:

```bash
export AWS_PROFILE=cloud-lab
```

---

## Step 2: Create the GitHub Repository

```bash
# In the project root
cd week1-terminal-dashboard

git init
git add .
git commit -m "feat: week1 terminal dashboard initial commit"
```

On GitHub:
1. **New repository** → name it `cloud-projects` (or `week1-terminal-dashboard`)
2. Keep it **Public** (required for free Amplify hosting)
3. Copy the remote URL

```bash
git remote add origin https://github.com/YOUR_USERNAME/cloud-projects.git
git branch -M main
git push -u origin main
```

> If this is a monorepo housing all weekly projects, push from the repo root and set `baseDirectory` in `amplify.yml` to `week1-terminal-dashboard/`.

---

## Step 3: Connect GitHub to AWS Amplify

### Option A — AWS Console (easiest first time)

1. Open **AWS Amplify** → **Create new app**
2. Select **GitHub** → Authorize AWS Amplify
3. Choose your repository and branch: `main`
4. Amplify detects `amplify.yml` automatically — review and confirm
5. Click **Save and deploy**

Amplify will:
- Clone the repo
- Run the build (just an `echo` for a static site)
- Deploy to a managed CDN
- Issue a TLS certificate automatically

Your app is live at:
```
https://main.XXXXXXXX.amplifyapp.com
```

### Option B — AWS CLI

```bash
# 1. Create the Amplify app
aws amplify create-app \
  --name "week1-terminal-dashboard" \
  --repository "https://github.com/YOUR_USERNAME/cloud-projects" \
  --platform WEB \
  --profile cloud-lab

# Note the appId in the output

# 2. Create a branch (triggers first deploy)
aws amplify create-branch \
  --app-id YOUR_APP_ID \
  --branch-name main \
  --profile cloud-lab

# 3. Start a manual deploy (first time only; subsequent pushes auto-deploy)
aws amplify start-job \
  --app-id YOUR_APP_ID \
  --branch-name main \
  --job-type RELEASE \
  --profile cloud-lab
```

---

## Step 4: Configure Continuous Deployment

After connecting GitHub, every push to `main` automatically triggers a new build and deploy. You can verify this:

```bash
# List recent jobs
aws amplify list-jobs \
  --app-id YOUR_APP_ID \
  --branch-name main \
  --profile cloud-lab
```

### Branch previews (optional)

Amplify can auto-deploy pull requests to unique preview URLs:

1. Amplify Console → your app → **Previews** → Enable
2. Every PR gets its own URL: `https://pr-N.XXXXXXXX.amplifyapp.com`

---

## Step 5: Wire Project Links in index.html

Once weekly projects are deployed, update the `href` attributes in `index.html`:

```html
<!-- Week 3: URL Shortener -->
<a class="project-row" href="https://main.XXXXXXXX.amplifyapp.com/week3" ...>

<!-- Or link to separate Amplify apps / domains -->
<a class="project-row" href="https://abc123.execute-api.us-east-1.amazonaws.com" ...>
```

Then push to trigger a redeploy:

```bash
git add index.html
git commit -m "chore: update week3 project link"
git push
```

Amplify picks up the push and deploys in ~30 seconds for a static site.

---

## Step 6: Custom Domain (optional)

Connect a domain you own (Route 53 or external registrar):

### AWS Console path

1. Amplify Console → your app → **Domain management** → **Add domain**
2. Enter your domain (e.g. `cloud-lab.dev`)
3. Amplify creates a CloudFront distribution + ACM certificate automatically
4. For Route 53: records are added automatically
5. For external DNS: add the provided CNAME records at your registrar

### CLI path

```bash
aws amplify create-domain-association \
  --app-id YOUR_APP_ID \
  --domain-name cloud-lab.dev \
  --sub-domain-settings prefix=www,branchName=main \
  --profile cloud-lab
```

Certificate provisioning takes 10–30 minutes (ACM validation via DNS).

---

## Git Workflow for This Project

```
main ──────────────────────────────────────────► production
         │              │
         └── feature/   └── week2-static-site
             week1-nav      (merge when ready)
```

### Recommended commit conventions

```bash
# New project entries
git commit -m "feat(w03): add url-shortener link to dashboard"

# Link updates
git commit -m "chore: update week3 href to production URL"

# Visual tweaks
git commit -m "style: adjust pending row opacity"

# Bug fixes
git commit -m "fix: boot sequence skips on reduced-motion"
```

### Adding a new week's project

1. Update the `project-row` in `index.html` — change `pending` class to active, add the `href`
2. Update the badge from `soon` to `live`
3. Update the `ls-footer` counts
4. Commit and push → Amplify redeploys automatically

---

## File Structure

```
week1-terminal-dashboard/
├── index.html        ← markup (terminal window + project list)
├── styles.css        ← all styling (tokens, layout, animations)
├── app.js            ← boot sequence, uptime clock, row hints
├── amplify.yml       ← Amplify build spec (CI/CD config)
├── DEPLOYMENT.md     ← this file
└── README.md         ← project overview
```

---

## IAM Permissions Reference

For tighter security, replace `AdministratorAccess` with this inline policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "amplify:*"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "acm:RequestCertificate",
        "acm:DescribeCertificate",
        "acm:ListCertificates",
        "route53:ChangeResourceRecordSets",
        "route53:ListHostedZones",
        "cloudfront:CreateDistribution",
        "cloudfront:UpdateDistribution"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## Cost Estimate

| Service | Free Tier | This project |
|---------|-----------|-------------|
| Amplify Hosting | 5 GB storage, 15 GB/month transfer | Free |
| Amplify Build | 1,000 build minutes/month | Free |
| ACM Certificate | Always free with AWS services | Free |
| Route 53 (if used) | $0.50/hosted zone/month | ~$0.50 |

**Total: $0/month** without a custom domain.

---

## Troubleshooting

**Build fails immediately**
→ Check `amplify.yml` indentation — YAML is whitespace-sensitive.
→ Ensure the file is committed and pushed before connecting the repo to Amplify.

**GitHub authorization fails**
→ Go to GitHub → Settings → Applications → Authorized OAuth Apps → revoke and reconnect AWS Amplify.

**Custom domain shows "SSL pending" forever**
→ ACM requires DNS validation. Check that the CNAME records from Amplify are correctly added at your registrar. Propagation can take up to 48 hours.

**Changes pushed but Amplify not rebuilding**
→ Verify the webhook is active: Amplify Console → your app → **General** → **Webhooks**. Delete and reconnect the GitHub repo if the webhook is missing.

**Boot animation doesn't play on first load**
→ Fonts from Google may not be cached. The animation starts on `DOMContentLoaded`, so slow font loads don't block it. If reduced-motion is enabled in the OS, the boot screen is skipped intentionally.

---

## Teardown

To remove all provisioned resources:

```bash
# Delete the Amplify app (removes hosting, CDN, build history)
aws amplify delete-app \
  --app-id YOUR_APP_ID \
  --profile cloud-lab

# Delete the IAM user (if no longer needed)
aws iam delete-access-key --user-name cloud-lab-deployer --access-key-id AKIA...
aws iam detach-user-policy --user-name cloud-lab-deployer \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
aws iam delete-user --user-name cloud-lab-deployer
```

The GitHub repo is unaffected — only AWS resources are removed.
