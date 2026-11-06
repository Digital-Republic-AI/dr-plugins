export async function addPagesDomains(client, { accountId, project, domains }) {
  const base = `/accounts/${accountId}/pages/projects/${encodeURIComponent(project)}/domains`;
  const existing = await client.read(`List the custom domains of the Pages project ${project}`, base);
  for (const domain of domains) {
    const found = existing?.find((item) => item.name === domain);
    if (found) {
      client.note(`${domain} is already attached to ${project}`, 'exists', { domainStatus: found.status ?? null });
      continue;
    }
    await client.write(`Attach ${domain} to the Pages project ${project}`, 'POST', base, { name: domain });
  }
  return { project, domains };
}
