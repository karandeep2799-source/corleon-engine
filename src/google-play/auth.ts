import { createSign } from 'node:crypto';
import { getGooglePlayConfig } from './config.js';
const SCOPES = ['https://www.googleapis.com/auth/androidpublisher','https://www.googleapis.com/auth/playdeveloperreporting'].join(' ');
let cachedToken: { value: string; expiresAt: number } | undefined;
export async function getGoogleAccessToken() {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) return cachedToken.value;
  const { serviceAccount } = getGooglePlayConfig();
  if (!serviceAccount) throw new Error('Google Play service-account credentials are not configured');
  const issuedAt = Math.floor(now / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claims = Buffer.from(JSON.stringify({ iss: serviceAccount.client_email, scope: SCOPES, aud: serviceAccount.token_uri || 'https://oauth2.googleapis.com/token', iat: issuedAt, exp: issuedAt + 3600 })).toString('base64url');
  const unsigned = header + '.' + claims;
  const signer = createSign('RSA-SHA256'); signer.update(unsigned); signer.end();
  const assertion = unsigned + '.' + signer.sign(serviceAccount.private_key).toString('base64url');
  const response = await fetch(serviceAccount.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }), cache: 'no-store',
  });
  if (!response.ok) throw new Error('Google OAuth token exchange failed (' + response.status + ')');
  const token = await response.json() as { access_token?: string; expires_in?: number };
  if (!token.access_token) throw new Error('Google OAuth response did not contain an access token');
  cachedToken = { value: token.access_token, expiresAt: now + (token.expires_in || 3600) * 1000 };
  return token.access_token;
}