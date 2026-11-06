---
name: cloudflare-static-publish
description: Publishes static sites (plain HTML or a build output such as Vite, Astro, Docusaurus, Eleventy or a Next.js export) on Cloudflare Workers Static Assets or Pages. Generates wrangler.jsonc, a manual deploy script and an optional GitHub Actions workflow, or guides the native Git integration; protects the site with Cloudflare Access One-time PIN for chosen e-mails or domains; and sets up custom domain DNS on Cloudflare zones or external providers. Cloudflare changes are planned first and applied only after confirmation. Not for Workers with server code, Functions or APIs.
license: MIT
compatibility: Requires Node.js 18+, npx (Wrangler 4 is fetched on demand), network access to api.cloudflare.com, and a Cloudflare account. API steps need CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in the environment.
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/*), AskUserQuestion
disable-model-invocation: true
metadata:
  version: "1.0.0"
---

# Publish static pages on Cloudflare

Publishing is a public, outward-facing action: once deployed, the content can be fetched, cached and indexed even if it is removed later. So this skill splits the job in two. A bundled script does the mechanical and verifiable parts (inspect the project, generate the files, build the exact API calls), and you do the judgment: pick the platform, show the plan, and get a clear yes before anything reaches Cloudflare.

Talk to the user in their language (Portuguese with full diacritics when they write in Portuguese). No emojis.

## Script

`scripts/cf-publish.mjs` (Node 18+, no dependencies). Run it from the project root; `<skill>` below is this skill's directory (`${CLAUDE_SKILL_DIR}`). Every subcommand prints JSON.

| Subcommand | What it does |
|------------|--------------|
| `detect` | Package manager, build script, framework and its usual output dir, candidate output dirs with `index.html` (file count, files over 25 MiB, `404.html`, `_headers`, `_redirects`), existing Wrangler configs, git remote and provider, existing workflows, whether the token and account id are set (never their values) |
| `scaffold --platform workers\|pages --name N --dir D [--build SCRIPT] [--not-found spa\|404\|none] [--domain H]... [--protect] [--git github-actions\|native\|none] [--manual-script true\|false] [--branch main] [--dry-run] [--force]` | Writes `wrangler.jsonc`, `scripts/deploy-cloudflare.sh` (default on), `.github/workflows/deploy-cloudflare.yml` (with `--git github-actions`) and `.assetsignore` when needed. Never overwrites without `--force`; a different existing Wrangler config blocks the write so the two can be merged by hand. `--build` is the package.json script name (`build`) |
| `auth [--account-id ID]` | Verifies `CLOUDFLARE_API_TOKEN` without printing it |
| `access --hostname H... (--email E... \| --email-domain D...) [--name N] [--session 24h] [--apply]` | Enables the One-time PIN login method, creates one allow policy and one Access application per hostname. Idempotent. Refuses (`blocked`) `pages.dev`/`workers.dev` hostnames and, with a token, hostnames with no active zone in the account; the output has `ok: false` when any hostname was blocked |
| `pages-domain --project P --domain H... [--apply]` | Attaches custom domains to a Pages project |
| `dns --hostname H --target T [--zone Z] [--proxied true\|false] [--external] [--apply]` | Creates a CNAME in the Cloudflare zone, or prints the record to create at an external provider. Never overwrites or deletes |
| `verify --url U... [--expect-access]` | Checks each URL: served by Cloudflare, HTTP status, redirect to the Access login |

Without `--apply`, `access`, `pages-domain` and `dns` only read (when a token is set) and print every write they would make as a `planned` step, with method, path and body. With `--apply`, they perform them. That is the confirmation mechanism: run without `--apply`, show the plan, apply after the user agrees. If a call fails midway, the output keeps the steps already done (`ok: false`, `error`, `steps`), and running it again is safe because existing objects are detected and left alone.

The account id comes from `--account-id` or `CLOUDFLARE_ACCOUNT_ID`. The token comes only from the environment. Never pass it as an argument, write it to a file, or echo it. If the user needs to set it, suggest they type `! export CLOUDFLARE_API_TOKEN=...` themselves; do not ask them to paste it into the chat.

## Workflow

### 1. Inspect

Run `detect`. From it, work out the build script, the output directory (the framework's usual folder, confirmed by an existing folder with `index.html`; for a site without build it is the folder that already holds `index.html`), SPA vs 404 handling (`suggestedNotFound`), and whether the site is too big (over 20,000 files on Free, or any file over 25 MiB: stop and say so, since the deploy would fail).

If the output directory does not exist yet because nothing was built, run the build once with the project's own script before deciding, or ask the user. An assets directory equal to the project root (`.`) uploads everything in it; prefer moving the site into a folder (`public/`), and if the user keeps `.`, the scaffold writes an `.assetsignore` that excludes the project files.

### 2. Decide with the user

Ask everything still open in one AskUserQuestion round, each question with a recommended default drawn from `detect`:

- **Domain.** Is there one, and is its DNS on Cloudflare or elsewhere? This decides the platform.
- **Platform.** Workers by default. Use Pages when the domain is a subdomain on an external DNS provider, or when the user wants per-branch preview URLs without CI. An apex domain on an external provider has to move to Cloudflare first, whichever platform. The full table is in `references/platforms-and-dns.md`.
- **Protection.** Who may open the site: specific e-mails and/or whole e-mail domains (One-time PIN), or public.

Protection and an external DNS provider do not combine. Cloudflare Access only protects hostnames of a zone that is active in the account (full setup, or partial CNAME setup on Business plans). A subdomain at Registro.br, Route 53 or GoDaddy, pointed to `<project>.pages.dev`, is served by Cloudflare but cannot be put behind Access. Attaching it would publish the site without login on that hostname. When the user asks for both, say so plainly and offer the ways out, recommending the first one that fits their constraints:

1. Move the zone's nameservers to Cloudflare (Free plan). Then use Workers with a Custom Domain and Access on it.
2. Publish on a hostname of a zone that is already on Cloudflare, for example a subdomain of the agency's own domain.
3. Keep the site only on `<project>.pages.dev`, protected from the dashboard. The custom domain stays out until the zone moves.
4. Use a partial (CNAME) setup of the zone, which keeps the DNS at the provider but needs a Business plan.

Do not attach the external hostname or hand out its CNAME as a final step while the site must stay private. Give the CNAME only as the step that comes after the zone question is solved, or when the user accepts that hostname being public.
- **Deploy.** The manual script always comes along. On top of it: GitHub Actions (versioned in the repository; needs two repository secrets), native integration (Cloudflare builds on push; set up in the dashboard), or none.
- **Project name.** Lowercase letters, digits and hyphens. It becomes `<name>.pages.dev` or the Worker name.

Do not ask what `detect` already answered. Do not ask about plan tiers or limits unless the site is near them.

### 3. Generate the files

Run `scaffold` with the decided values, with `--protect` when there will be an Access policy. Show the generated `wrangler.jsonc`, and for the others say what each one does and where it is. For `--git native` there is no workflow file; the steps are in `references/git-deploy.md`.

With `--protect` on Workers, the config turns off `workers.dev` and preview URLs, because the Access application on the custom domain does not cover them. Say this in one line. On Workers without a custom domain, Access can only be enabled in the dashboard (`references/access-one-time-pin.md`).

On Workers, validate the generated config locally with `npx --yes wrangler@4 deploy --dry-run` from the project root, after the build output exists. It reads the config and the assets and uploads nothing, so it needs no confirmation and no credentials. It catches a wrong `assets.directory`, invalid keys and oversized files before the real deploy. Report its result. Pages has no equivalent dry run; the `detect` check of `index.html` and file sizes is what there is.

### 4. Credentials

The deploy needs Wrangler authentication: `CLOUDFLARE_API_TOKEN` plus `CLOUDFLARE_ACCOUNT_ID`, or a previous `npx wrangler@4 login` by the user. The API steps (`access`, `pages-domain`, `dns`) always need the token. Tell the user exactly which permissions the chosen steps need (table in `references/git-deploy.md`), then run `auth`.

If there is no token and the user does not want one now, go on with `wrangler login` for the deploy, and leave the API steps as plans with the exact dashboard equivalent.

### 5. Apply, in this order

Each step below is a separate confirmation: show the plan or the command, wait for the yes, run, report the result. Do not chain them on a single approval.

When protection was asked, the protection is in place before any content is deployed, so the site is never public, not even for a minute. The order differs per platform.

**Workers:**

1. **Access:** run `access` for the custom domains without `--apply`. Show the plan: who is allowed, which hostnames, session duration, and any `blocked` hostname with its reason. Then run it with `--apply`. An Access application can exist before the hostname serves anything.
2. **First deploy:** `./scripts/deploy-cloudflare.sh` (or `npx wrangler@4 deploy`). With `custom_domain`, this also creates the DNS record and the certificate. If it fails because the hostname already has a record, show the record and let the user decide; the skill never deletes DNS records.

**Pages:**

1. **Project:** create it with `npx wrangler@4 pages project create <name> --production-branch <branch>`. Nothing is served until the first deploy. Skip this step when the user chose Pages native Git integration: a project created this way can never be connected to Git, so create it from the dashboard instead (`references/git-deploy.md`).
2. **Custom domain, for a hostname in a Cloudflare zone:** run `pages-domain`, then `dns`. Wait for the domain to show as Active in the Pages dashboard, which means the certificate was issued. The domain has to come before Access: Pages refuses a custom domain that already has an Access policy, and the certificate validation needs `/.well-known/acme-challenge/*` reachable.
3. **Access on the custom domain:** run `access` for it, plan first and then `--apply`.
4. **Access on `<name>.pages.dev` and its previews:** this is a dashboard step that the user does. The `access` subcommand refuses `pages.dev` hostnames, because they are not zones of the account. The steps are in `references/access-one-time-pin.md`. Wait for the user to confirm it is done.
5. **First deploy:** `./scripts/deploy-cloudflare.sh`.

**Pages with a public site on an external DNS provider:** run `pages-domain` (plan, then apply), then `dns --external`. It returns the record (type, name, value) to give the user, with the warnings that apply: attach before pointing, CAA, apex.

**Then, on either platform:**

1. **Git:**
   - **GitHub Actions:** commit the workflow only if the user asks. Explain the two secrets, and that the user sets them with `! gh secret set CLOUDFLARE_API_TOKEN` (it prompts for the value).
   - **Native integration:** walk through the dashboard steps.

### 6. Verify and report

Run `verify` on every public URL, with `--expect-access` on the protected ones. DNS at an external provider can take time to resolve; report `ENOTFOUND` as pending, not as a failure.

Close with:

- A table, one row per URL: URL, platform, protection (public, or One-time PIN for whom), verify result.
- How to deploy again (the script, or "push to `<branch>`").
- What is still the user's to do, each item concrete: the DNS record to create at the provider, the GitHub secrets, the dashboard step for native Git or for `workers.dev` Access, and the Zero Trust onboarding if it was missing.
- The files created, with full paths.

## Things that go wrong

- **Zero Trust organization missing.** The first `access` call fails with an organization error. Onboarding (team name, Free plan, payment method on file) is a dashboard step; send the user there and continue with the deploy only if they accept the site being public meanwhile, or wait.
- **Existing Wrangler config.** `scaffold` will not add a second one. Read it, merge the needed keys (`assets`, `routes`, `workers_dev`, `preview_urls`) with the user's approval, and keep their other settings.
- **The Worker or project name already exists in the account.** The deploy would overwrite it. If `detect` or the deploy output suggests that, stop and ask.
- **`access` reports a hostname as blocked.** Do not work around it by attaching the domain anyway. Go back to the protection-and-DNS choice in step 2 with the user.
- **Next.js and other SSR frameworks.** Only a static export is in scope (`output: "export"`, folder `out`). A site that needs a server is not static: say so instead of publishing a broken build.
- **SPA on Workers without `--not-found spa`.** Deep links return 404. Pages handles this alone; Workers does not.
