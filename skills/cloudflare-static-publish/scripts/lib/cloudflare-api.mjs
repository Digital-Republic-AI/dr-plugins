import { API_BASE_URL, ENV_API_TOKEN, LIST_PAGE_SIZE } from './constants.mjs';

export class ApiError extends Error {
  constructor(method, path, status, errors) {
    const detail = (errors ?? []).map((error) => `${error.code ?? '-'}: ${error.message}`).join('; ') || 'no error detail';
    super(`${method} ${path} failed (HTTP ${status}): ${detail}`);
    this.status = status;
    this.errors = errors ?? [];
  }
}

async function parsePayload(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    return { success: false, errors: [{ message: `non-JSON response: ${text.slice(0, 200)}` }] };
  }
}

function withQuery(path, query) {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${new URLSearchParams(query)}`;
}

// Reads run whenever a token is available; writes run only with apply. Without them each step is recorded as planned,
// so the same call produces the plan to show the user and, after confirmation, the real change.
export function createApiClient({ token, apply, fetchImpl = fetch }) {
  const steps = [];

  async function request(method, path, body) {
    const response = await fetchImpl(`${API_BASE_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await parsePayload(response);
    if (!response.ok || payload.success === false) throw new ApiError(method, path, response.status, payload.errors);
    return payload;
  }

  async function readAll(path) {
    const results = [];
    for (let page = 1; ; page += 1) {
      const payload = await request('GET', withQuery(path, { page, per_page: LIST_PAGE_SIZE }));
      const items = Array.isArray(payload.result) ? payload.result : [];
      results.push(...items);
      const totalPages = payload.result_info?.total_pages;
      if (!totalPages || page >= totalPages || items.length === 0) return results;
    }
  }

  return {
    steps,
    canRead: Boolean(token),
    async read(description, path, { paginate = false } = {}) {
      if (!token) {
        steps.push({ description, method: 'GET', path, status: 'skipped', reason: `${ENV_API_TOKEN} not set` });
        return null;
      }
      const result = paginate ? await readAll(path) : (await request('GET', path)).result;
      steps.push({ description, method: 'GET', path, status: 'done' });
      return result;
    },
    async write(description, method, path, body) {
      if (!apply || !token) {
        steps.push({ description, method, path, body, status: 'planned' });
        return null;
      }
      const { result } = await request(method, path, body);
      steps.push({ description, method, path, body, status: 'done', id: result?.id ?? null });
      return result;
    },
    note(description, status, extra = {}) {
      steps.push({ description, status, ...extra });
    },
  };
}
