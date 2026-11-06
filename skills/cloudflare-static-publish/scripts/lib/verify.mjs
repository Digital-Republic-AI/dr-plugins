import { ACCESS_LOGIN_HOST_SUFFIX, HTTP_ERROR_MIN, HTTP_REDIRECT_MAX, HTTP_REDIRECT_MIN, VERIFY_TIMEOUT_MS } from './constants.mjs';

function isRedirect(status) {
  return status >= HTTP_REDIRECT_MIN && status <= HTTP_REDIRECT_MAX;
}

function redirectsToAccess(location, url) {
  if (!location) return false;
  try {
    return new URL(location, url).hostname.endsWith(ACCESS_LOGIN_HOST_SUFFIX);
  } catch (error) {
    return false;
  }
}

export async function verifyUrl(url, { expectAccess }) {
  try {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS) });
    const location = response.headers.get('location');
    const accessProtected = isRedirect(response.status) && redirectsToAccess(location, url);
    const servedByCloudflare = Boolean(response.headers.get('cf-ray'));
    const ok = expectAccess ? accessProtected : response.status < HTTP_ERROR_MIN && servedByCloudflare;
    return { url, ok, status: response.status, location, accessProtected, servedByCloudflare, error: null };
  } catch (error) {
    return { url, ok: false, status: null, location: null, accessProtected: false, servedByCloudflare: false, error: error.cause?.code ?? error.message };
  }
}
