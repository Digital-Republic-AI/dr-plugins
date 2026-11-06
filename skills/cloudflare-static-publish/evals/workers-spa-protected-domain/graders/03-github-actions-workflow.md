---
type: llm
focus: trace
weight: 1
---

A GitHub Actions workflow is created that runs on push to main, installs and builds the project, and deploys with wrangler (cloudflare/wrangler-action or a wrangler deploy step) using the repository secrets CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID
