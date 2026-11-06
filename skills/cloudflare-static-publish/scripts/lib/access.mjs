import {
  ACCESS_APP_TYPE,
  ACTIVE_ZONE_STATUS,
  DASHBOARD_ONLY_ACCESS_SUFFIXES,
  ACCESS_POLICY_PRECEDENCE,
  OTP_IDP_NAME,
  OTP_IDP_TYPE,
  PLACEHOLDER_IDP_ID,
  PLACEHOLDER_POLICY_ID,
} from './constants.mjs';
import { findZone, guessZone } from './zones.mjs';

export function buildIncludeRules({ emails, emailDomains }) {
  return [
    ...emails.map((email) => ({ email: { email } })),
    ...emailDomains.map((domain) => ({ email_domain: { domain } })),
  ];
}

async function ensureOtpProvider(client, base) {
  const providers = await client.read('List the login methods of the Zero Trust organization', `${base}/identity_providers`);
  const existing = providers?.find((provider) => provider.type === OTP_IDP_TYPE);
  if (existing) {
    client.note('One-time PIN login method already enabled', 'exists', { id: existing.id });
    return existing.id;
  }
  const description = providers
    ? 'Enable the One-time PIN login method'
    : 'Enable the One-time PIN login method (skipped at apply time if it already exists)';
  const created = await client.write(description, 'POST', `${base}/identity_providers`, {
    name: OTP_IDP_NAME,
    type: OTP_IDP_TYPE,
    config: {},
  });
  return created?.id ?? PLACEHOLDER_IDP_ID;
}

async function ensurePolicy(client, base, { policyName, include, sessionDuration }) {
  const policies = await client.read('List the reusable Access policies', `${base}/policies`, { paginate: true });
  const existing = policies?.find((policy) => policy.name === policyName);
  if (existing) {
    client.note(`Policy "${policyName}" already exists; its rules were not changed`, 'exists', { id: existing.id, include: existing.include });
    return existing.id;
  }
  const created = await client.write(`Create the allow policy "${policyName}"`, 'POST', `${base}/policies`, {
    name: policyName,
    decision: 'allow',
    include,
    session_duration: sessionDuration,
  });
  return created?.id ?? PLACEHOLDER_POLICY_ID;
}

function appBody({ name, hostname, sessionDuration, idpId, policyId }) {
  return {
    name: `${name} (${hostname})`,
    type: ACCESS_APP_TYPE,
    domain: hostname,
    session_duration: sessionDuration,
    allowed_idps: [idpId],
    // Exactly one login method is allowed, so the visitor goes straight to the e-mail prompt.
    auto_redirect_to_identity: true,
    policies: [{ id: policyId, precedence: ACCESS_POLICY_PRECEDENCE }],
  };
}

async function ensureApp(client, base, apps, settings) {
  const existing = apps?.find((app) => app.domain === settings.hostname);
  if (existing) {
    client.note(`Access application for ${settings.hostname} already exists; it was not changed`, 'exists', {
      id: existing.id,
      name: existing.name,
      allowedIdps: existing.allowed_idps ?? null,
    });
    return;
  }
  await client.write(`Protect ${settings.hostname} with an Access application`, 'POST', `${base}/apps`, appBody(settings));
}

const DASHBOARD_HINT = {
  '.pages.dev': 'Pages project > Settings > General > Enable access policy, then edit the generated Access application to also cover <project>.pages.dev',
  '.workers.dev': 'Worker > Settings > Domains & Routes > enable Cloudflare Access on workers.dev and Preview URLs',
};

// Access only protects hostnames of an active zone in the account (full or partial setup).
async function checkHostname(client, hostname) {
  const ownedSuffix = DASHBOARD_ONLY_ACCESS_SUFFIXES.find((suffix) => hostname.endsWith(suffix));
  if (ownedSuffix) {
    return { hostname, allowed: false, reason: `${ownedSuffix.slice(1)} is not a zone of the account; enable Access in the dashboard: ${DASHBOARD_HINT[ownedSuffix]}` };
  }
  if (!client.canRead) {
    return { hostname, allowed: true, precondition: `the zone of ${hostname} (probably ${guessZone(hostname)}) must be active in this account` };
  }
  const zone = await findZone(client, hostname, null);
  if (!zone) {
    return { hostname, allowed: false, reason: `no zone for ${hostname} in this account: Access cannot protect a hostname whose DNS is outside Cloudflare` };
  }
  if (zone.status !== ACTIVE_ZONE_STATUS) {
    return { hostname, allowed: false, reason: `zone ${zone.name} is ${zone.status}, not active: Access needs an active zone` };
  }
  return { hostname, allowed: true, zone: zone.name };
}

async function checkHostnames(client, hostnames) {
  const checks = [];
  for (const hostname of hostnames) checks.push(await checkHostname(client, hostname));
  for (const check of checks.filter((item) => !item.allowed)) {
    client.note(`Access application for ${check.hostname} not created`, 'blocked', { reason: check.reason });
  }
  return checks;
}

export async function configureAccess(client, { accountId, hostnames, emails, emailDomains, name, sessionDuration }) {
  const base = `/accounts/${accountId}/access`;
  const include = buildIncludeRules({ emails, emailDomains });
  const checks = await checkHostnames(client, hostnames);
  const allowed = checks.filter((check) => check.allowed).map((check) => check.hostname);
  const blocked = checks.filter((check) => !check.allowed);
  const preconditions = checks.filter((check) => check.precondition).map((check) => check.precondition);
  if (allowed.length === 0) return { hostnames: allowed, blocked, preconditions, include, sessionDuration };
  const idpId = await ensureOtpProvider(client, base);
  const policyId = await ensurePolicy(client, base, { policyName: `${name} - allowed visitors`, include, sessionDuration });
  const apps = await client.read('List the existing Access applications', `${base}/apps`, { paginate: true });
  for (const hostname of allowed) {
    await ensureApp(client, base, apps, { name, hostname, sessionDuration, idpId, policyId });
  }
  return { hostnames: allowed, blocked, preconditions, include, sessionDuration };
}
