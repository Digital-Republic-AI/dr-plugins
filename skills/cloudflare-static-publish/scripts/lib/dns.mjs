import { DNS_RECORD_COMMENT, DNS_RECORD_TYPE, DNS_TTL_AUTO, PLACEHOLDER_ZONE_ID } from './constants.mjs';
import { UsageError } from './args.mjs';
import { apexLabelCount, findZone, guessZone } from './zones.mjs';

export function isApex(hostname, zoneName) {
  if (zoneName) return hostname === zoneName;
  return hostname.split('.').length <= apexLabelCount(hostname);
}

function recordName(hostname, zoneName) {
  const zone = zoneName ?? guessZone(hostname);
  if (!hostname.endsWith(zone)) return hostname;
  return hostname === zone ? '@' : hostname.slice(0, -(zone.length + 1));
}

export function externalInstructions({ hostname, target, zoneName, reason }) {
  const apex = isApex(hostname, zoneName);
  const warnings = [
    'Add the domain to the Pages project (pages-domain) before creating the record, or the site answers with error 522.',
    'If the domain has CAA records, they must allow the certificate authorities Cloudflare uses (letsencrypt.org, pki.goog, ssl.com, digicert.com).',
    'Cloudflare Access cannot protect a hostname whose zone is not active in the account: once this record exists, the site is public on this hostname.',
  ];
  if (apex) {
    warnings.unshift(
      'This is an apex domain: most DNS providers cannot point it with a CNAME. Move the zone nameservers to Cloudflare, or use a subdomain (www, docs, app).',
    );
  }
  return {
    mode: 'external',
    reason,
    record: { type: DNS_RECORD_TYPE, name: recordName(hostname, zoneName), fullName: hostname, value: target, ttl: 'provider default (or 3600)' },
    apex,
    warnings,
  };
}

async function upsertCname(client, zoneRecord, { hostname, target, proxied }) {
  const records = await client.read(`List DNS records named ${hostname}`, `/zones/${zoneRecord.id}/dns_records?name=${encodeURIComponent(hostname)}`);
  const matching = records?.find((record) => record.type === DNS_RECORD_TYPE && record.content === target);
  if (matching) {
    client.note(`CNAME ${hostname} -> ${target} already exists`, 'exists', { id: matching.id, proxied: matching.proxied });
    return { mode: 'cloudflare', zone: zoneRecord, status: 'exists' };
  }
  if (records?.length) {
    const found = records.map(({ type, content, proxied: isProxied }) => ({ type, content, proxied: isProxied }));
    client.note(`${hostname} already has other DNS records; nothing was changed`, 'conflict', { records: found });
    return { mode: 'cloudflare', zone: zoneRecord, status: 'conflict', records: found };
  }
  await client.write(`Create CNAME ${hostname} -> ${target}`, 'POST', `/zones/${zoneRecord.id}/dns_records`, {
    type: DNS_RECORD_TYPE,
    name: hostname,
    content: target,
    proxied,
    ttl: DNS_TTL_AUTO,
    comment: DNS_RECORD_COMMENT,
  });
  return { mode: 'cloudflare', zone: zoneRecord, status: 'created-or-planned' };
}

export async function configureDns(client, { hostname, target, zone, proxied, external }) {
  if (external) return externalInstructions({ hostname, target, zoneName: zone ?? null, reason: 'DNS hosted outside Cloudflare (--external)' });
  if (!client.canRead) {
    if (!zone) throw new UsageError('without CLOUDFLARE_API_TOKEN the zone cannot be looked up: pass --zone, or --external for a DNS provider outside Cloudflare');
    return upsertCname(client, { id: PLACEHOLDER_ZONE_ID, name: zone, status: 'unknown' }, { hostname, target, proxied });
  }
  const zoneRecord = await findZone(client, hostname, zone);
  if (!zoneRecord) {
    return externalInstructions({ hostname, target, zoneName: zone ?? null, reason: 'no zone for this hostname in the Cloudflare account the token can read' });
  }
  return upsertCname(client, zoneRecord, { hostname, target, proxied });
}
