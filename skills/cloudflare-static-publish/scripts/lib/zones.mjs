import { APEX_LABEL_COUNT, MULTI_LABEL_PUBLIC_SUFFIXES } from './constants.mjs';

export function apexLabelCount(hostname) {
  const suffix = MULTI_LABEL_PUBLIC_SUFFIXES.find((candidate) => hostname.endsWith(`.${candidate}`));
  return suffix ? suffix.split('.').length + 1 : APEX_LABEL_COUNT;
}

export function guessZone(hostname) {
  return hostname.split('.').slice(-apexLabelCount(hostname)).join('.');
}

export function zoneCandidates(hostname) {
  const labels = hostname.replace(/^\*\./, '').split('.');
  const minimum = apexLabelCount(hostname);
  const candidates = [];
  for (let start = 0; labels.length - start >= minimum; start += 1) candidates.push(labels.slice(start).join('.'));
  return candidates;
}

export async function findZone(client, hostname, zone) {
  const candidates = zone ? [zone] : zoneCandidates(hostname);
  for (const name of candidates) {
    const zones = await client.read(`Look up the zone ${name}`, `/zones?name=${encodeURIComponent(name)}`);
    if (zones?.length) return { id: zones[0].id, name: zones[0].name, status: zones[0].status };
  }
  return null;
}
