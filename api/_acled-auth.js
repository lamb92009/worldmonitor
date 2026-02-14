// ACLED OAuth token manager - auto-fetches and caches Bearer tokens
// Uses ACLED_EMAIL + ACLED_PASSWORD env vars to get 24h OAuth tokens
// Falls back to static ACLED_ACCESS_TOKEN if set

let cachedToken = null;
let tokenExpiresAt = 0;
let refreshToken = null;

export async function getAcledToken() {
  // Prefer static token if explicitly set
  if (process.env.ACLED_ACCESS_TOKEN) {
    return process.env.ACLED_ACCESS_TOKEN;
  }

  const email = process.env.ACLED_EMAIL;
  const password = process.env.ACLED_PASSWORD;
  if (!email || !password) {
    return null;
  }

  const now = Date.now();

  // Return cached token if still valid (with 5min buffer)
  if (cachedToken && now < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedToken;
  }

  // Try refresh token first (if we have one)
  if (refreshToken) {
    try {
      const token = await fetchToken({ grant_type: 'refresh_token', refresh_token: refreshToken });
      if (token) return token;
    } catch (_) {
      // Refresh failed, fall through to password grant
    }
  }

  // Fetch new token with password grant
  return fetchToken({ grant_type: 'password', username: email, password });
}

async function fetchToken(params) {
  const body = new URLSearchParams({
    client_id: 'acled',
    ...params,
  });

  const response = await fetch('https://acleddata.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    console.error(`[acled-auth] token fetch failed: ${response.status}`);
    cachedToken = null;
    return null;
  }

  const data = await response.json();
  cachedToken = data.access_token;
  refreshToken = data.refresh_token || refreshToken;
  // expires_in is in seconds, default to 23 hours if missing
  const expiresIn = (data.expires_in || 82800) * 1000;
  tokenExpiresAt = Date.now() + expiresIn;

  console.log(`[acled-auth] token acquired, expires in ${Math.round(expiresIn / 3600000)}h`);
  return cachedToken;
}
