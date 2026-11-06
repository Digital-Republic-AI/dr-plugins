# Platform choice, limits and DNS

Checked against developers.cloudflare.com on 2026-11-06. Read the section you need; the decision table is enough for most cases.

## Contents

- Choosing Workers Static Assets or Pages
- Workers Static Assets settings
- Pages specifics
- Limits
- DNS: zone on Cloudflare
- DNS: provider outside Cloudflare
- Hiding the default hostnames

## Choosing Workers Static Assets or Pages

Cloudflare's current guidance is to start new projects on Workers ("Workers supports most Pages use cases... Start new projects with Workers"). Pages is not deprecated and still has two things Workers does not: custom domains on a DNS provider outside Cloudflare (a CNAME to `<project>.pages.dev`), and an automatic preview URL per branch from a plain `wrangler pages deploy --branch`.

| Situation | Platform | Why |
|-----------|----------|-----|
| Domain whose zone is on Cloudflare (any plan) | Workers | Custom Domain in `wrangler.jsonc`: the deploy creates the DNS record and the certificate |
| Public site, subdomain on an external DNS provider (Registro.br, Route 53, GoDaddy...) | Pages | Workers Custom Domains need the zone on Cloudflare; a CNAME to `*.pages.dev` works from any provider |
| Login required, domain on an external DNS provider | Move the zone to Cloudflare (then Workers), or use another hostname | Access only protects hostnames of an active zone in the account; the external hostname would be public. Until then, only `<project>.pages.dev` can be protected (Pages, from the dashboard) |
| Apex domain (`cliente.com.br`) on an external provider | Move the zone to Cloudflare, then Workers | An apex cannot be a CNAME at most providers, on either platform |
| No domain yet | Workers | `<name>.<account-subdomain>.workers.dev`; a domain can be added later without changing the deploy |
| Existing Pages project, Direct Upload | Keep Pages | Moving it is a migration, not part of a publish; Direct Upload projects can never switch to Git integration |
| Needs a preview URL per branch with no CI | Pages | `--branch=<name>` gives `<branch>.<project>.pages.dev` |

Partial (CNAME) zone setup, which would let Workers serve a hostname on an external provider, requires a Business or Enterprise zone plan; do not suggest it for a static site unless the user already has it.

## Workers Static Assets settings

An assets-only Worker has no `main`. The generated `wrangler.jsonc`:

| Key | Meaning |
|-----|---------|
| `assets.directory` | Folder uploaded as the site (the build output) |
| `assets.not_found_handling` | `single-page-application` returns `index.html` with 200 for unknown paths (React/Vue/Angular routers); `404-page` serves the nearest `404.html` with 404 (static generators). Unset returns an empty 404. Pages detects this alone; Workers does not, so always decide it |
| `assets.html_handling` | Trailing-slash behavior; default `auto-trailing-slash` is right for nearly every site |
| `routes[].custom_domain: true` | Custom Domain: DNS record and certificate managed by Cloudflare. One entry per hostname; `www` and the apex are separate entries; no wildcards. The hostname must not already have a CNAME |
| `workers_dev: false` | Turns off `<name>.<subdomain>.workers.dev` on the next deploy (inferred when `routes` exist, set explicitly anyway) |
| `preview_urls: false` | Turns off version and preview URLs, which `workers_dev: false` does not cover |

`_headers` and `_redirects` in the assets directory work on Workers as on Pages (max 100 header rules; 2,000 static + 100 dynamic redirects). `.assetsignore` in the assets directory, with `.gitignore` syntax, excludes files from the upload; the scaffold writes it only when the assets directory is a source folder, since a build output folder is recreated on every build.

## Pages specifics

- Create the project before the first deploy: `npx wrangler@4 pages project create <name> --production-branch main`. Check the flags with `--help` if the command rejects them.
- `wrangler pages deploy <dir> --project-name <name> --branch <branch>`: the production branch updates `<project>.pages.dev` and the custom domains; any other branch creates a preview at `<branch>.<project>.pages.dev`. Preview URLs are public unless protected (see the Access reference).
- `wrangler.jsonc` with `pages_build_output_dir` makes the output directory part of the repository config.
- SPA fallback and `404.html` are automatic on Pages: with a `404.html` it is served for unknown paths, without one every unknown path returns `index.html`.
- A custom domain is attached to the project first (`pages-domain`), and only then is the DNS record created. In the other order the site answers 522 until it is attached.

## Limits

| Item | Workers | Pages |
|------|---------|-------|
| Files per deploy | 20,000 Free; 100,000 Paid (Wrangler 4.34+) | 20,000 Free; 100,000 Pro and above |
| Size per file | 25 MiB | 25 MiB |
| Projects | - | 100 per account |

`detect` reports file count and files over 25 MiB per candidate directory. A file over the limit fails the whole deploy: move it to R2 or another storage and link to it.

## DNS: zone on Cloudflare

- Workers: nothing to do by hand. `wrangler deploy` with `custom_domain: true` creates the record. If the hostname already has a record (an old A or CNAME), the deploy fails: show the record to the user and ask before removing it in the dashboard; the `dns` subcommand never deletes records.
- Pages: `pages-domain` first, then `dns --hostname <host> --target <project>.pages.dev` creates a proxied CNAME. For the apex in a Cloudflare zone, attaching the domain to the project is enough; Cloudflare creates the record.

The `dns` subcommand finds the zone by walking up the hostname (`docs.cliente.com.br`, then `cliente.com.br`). It never overwrites: an existing record with another value is reported as `conflict`.

## DNS: provider outside Cloudflare

Only for Pages, a subdomain, and a site that may be public on that hostname: Access cannot protect it (see the decision table). The `dns --external` output gives the record to create:

| Field | Value |
|-------|-------|
| Type | CNAME |
| Name | the subdomain label (`docs` for `docs.cliente.com.br`) |
| Value | `<project>.pages.dev` |
| TTL | provider default, or 3600 |

Then:

1. Attach the domain to the Pages project before creating the record (`pages-domain`).
2. If the zone has CAA records, they must allow Cloudflare's certificate authorities (`letsencrypt.org`, `pki.goog`, `ssl.com`, `digicert.com`); otherwise the certificate is never issued.
3. Propagation can take from minutes to a few hours. `verify` reports `ENOTFOUND` until the record resolves; the Pages dashboard shows the domain as Active once the certificate is issued.
4. Repointing the record elsewhere and back deactivates the domain until it is verified again.

Registro.br accepts CNAME records on subdomains when the domain uses Registro.br's own DNS in advanced mode ("Modo avançado"); switching to that mode can take a while to take effect. Check the current Registro.br panel rather than promising exact menu names.

## Hiding the default hostnames

A site protected by Access on its custom domain is still public on its default hostname unless that hostname is also closed:

- Workers: `workers_dev: false` and `preview_urls: false` (the scaffold sets both with `--protect`).
- Pages: `<project>.pages.dev` cannot be turned off. Protect it with its own Access application (see the Access reference).
