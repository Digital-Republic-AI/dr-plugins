# Cloudflare Access with One-time PIN

How to put a static site behind an e-mail login with a one-time code, with no identity provider to configure. Checked against developers.cloudflare.com on 2026-11-06.

## Contents

- How the login works
- Prerequisites (Zero Trust organization, plan, token)
- What the `access` subcommand creates
- Which hostnames to protect
- Order: protect before the first deploy
- Testing and troubleshooting

## How the login works

The visitor opens the site, Cloudflare redirects to `<team>.cloudflareaccess.com`, the visitor types an e-mail, and if that e-mail matches an allow rule of the application, Cloudflare sends a 6-digit code to it. The code is single-use and expires in 10 minutes. After login, the session lasts the application's `session_duration` (default here `24h`).

An e-mail that does not match any rule receives no code, and the page does not say why: that is by design, so a visitor cannot probe which addresses are allowed. The most common complaint, "the code never arrives", is usually an address outside the rules.

## Prerequisites

1. **The hostname is in an active zone of the account.** Access self-hosted applications only accept "domains [that] belong to an active zone in your Cloudflare account" (full setup, or partial CNAME setup). A subdomain whose DNS stays at an external provider, even when it points to `<project>.pages.dev`, cannot be protected; neither can `pages.dev` or `workers.dev` hostnames through the API, since they are Cloudflare's, not the account's. The `access` subcommand checks this when a token is set and reports such hostnames as `blocked`.
2. **Zero Trust organization.** The account needs a Zero Trust organization with a team name, created once in the dashboard (Zero Trust > onboarding). The Free plan asks for a payment method even at zero cost. If the `access` subcommand fails on the first GET with an error about the organization, this step is missing; it cannot be done through this skill.
3. **Plan limits.** The Free plan allows 50 Access applications per account, and each protected hostname is one application. It also caps the number of users (seats); check the current Zero Trust plans page before promising a number to a large audience.
4. **API token permissions** (Account level, plus Zone > Zone > Read on the zones of the protected hostnames, used to check them):
   - `Access: Organizations, Identity Providers, and Groups` - Edit (to enable One-time PIN)
   - `Access: Apps and Policies` - Edit (to create the policy and the applications)

## What the `access` subcommand creates

All idempotent: anything that already exists is reported as `exists` and left unchanged.

1. The One-time PIN login method, `POST /accounts/{id}/access/identity_providers` with `{"name": "One-time PIN", "type": "onetimepin", "config": {}}`, only when the organization does not have it yet.
2. One reusable allow policy, `POST /accounts/{id}/access/policies`, named `<name> - allowed visitors`, with one `include` rule per address (`{"email": {"email": "..."}}`) and per domain (`{"email_domain": {"domain": "..."}}`). Include rules are OR: any match is enough.
3. One self-hosted application per hostname, `POST /accounts/{id}/access/apps`, with `allowed_idps` set to the One-time PIN method only and `auto_redirect_to_identity: true`, so the visitor goes straight to the e-mail prompt, and the policy attached with precedence 1.

If a policy with the same name exists, it is reused as is: when the user wants to change who has access, edit the policy in the dashboard (Zero Trust > Access > Policies) or tell them its rules differ from the requested ones. The subcommand does not edit existing objects.

## Which hostnames to protect

| Platform | Through `access` (API) | In the dashboard (the user does it) |
|----------|------------------------|--------------------------------------|
| Workers with custom domain | each custom domain | nothing: `workers.dev` and preview URLs are turned off by the scaffold (`--protect`) |
| Workers without custom domain | nothing | Worker > Settings > Domains & Routes: enable Cloudflare Access on `workers.dev` and on Preview URLs |
| Pages, custom domain in a Cloudflare zone | each custom domain | `<project>.pages.dev` and its previews (steps below) |
| Pages, no custom domain | nothing | `<project>.pages.dev` and its previews (steps below) |
| Any platform, hostname on an external DNS provider | not possible | not possible: the zone has to move to Cloudflare (or partial setup), or use another hostname |

Protecting `<project>.pages.dev` and the previews, as documented in the Pages known issues:

1. Pages project > Settings > General > **Enable access policy**. This creates an Access application for the previews (`*.<project>.pages.dev`), restricted to members of the Cloudflare account.
2. Zero Trust > Access > Applications: edit that application. In the public hostname, delete the wildcard (`*`) from the subdomain so it covers `<project>.pages.dev`, and save; renaming the application may be needed to avoid an error.
3. Back in the Pages project, enable the access policy again, so that the previews get their application too. Two applications now exist: `<project>.pages.dev` and `*.<project>.pages.dev`.
4. In both, set the policy to the allowed e-mails or e-mail domains, and the login method to One-time PIN. The policy the `access` subcommand created (`<name> - allowed visitors`) can be selected there, when one exists.
5. A custom domain of the project needs its own application (from `access`, or "Add public hostname" in the same application). Without it, "an Access authentication will render but not work for your custom domain visitors".

## Order: protect before the first deploy

The goal is that the content is never public, not even for the minutes between a deploy and a policy: search engines and link previews fetch fast.

- Workers: `access` for the custom domains, then the first deploy. An Access application can exist before the hostname serves anything.
- Pages: first create the project (it serves nothing yet). Then attach the custom domain and wait until it is Active. Pages refuses to add a custom domain that already has an Access policy, and the certificate validation needs `/.well-known/acme-challenge/*` reachable, so the domain must come before its policy. Then create the Access application for the custom domain. Then protect `pages.dev` in the dashboard. Only then do the first `pages deploy`.

## Testing and troubleshooting

- `verify --url https://<host> --expect-access` passes when the site answers with a redirect to `*.cloudflareaccess.com`. A 200 means the hostname is not covered.
- A visitor in the allow list gets no code: check spam, check the address against the policy, check that the application's login methods include One-time PIN only.
- Login page that does not work on a custom domain of Pages: the custom domain needs its own self-hosted application; the one for `pages.dev` does not cover it.
- The Pages custom domain stays Pending after Access was enabled on it: the certificate validation is being blocked. Remove the Access application, wait for Active, then create it again.
- To revoke someone, remove them from the policy; existing sessions last until `session_duration` ends, or revoke them in Zero Trust > Users.
