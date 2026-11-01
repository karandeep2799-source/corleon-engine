#!/usr/bin/env node
import { createSign } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const args = new Set(process.argv.slice(3));
const fileArg = process.argv[2];
const track = process.env.GOOGLE_PLAY_TRACK || 'internal';
const releaseStatus = process.env.GOOGLE_PLAY_RELEASE_STATUS || 'draft';
const allowedTracks = new Set(['internal', 'alpha', 'beta', 'production']);
const allowedStatuses = new Set(['draft', 'inProgress', 'halted', 'completed']);

function fail(message) { console.error('Google Play publisher: ' + message); process.exit(1); }
if (!fileArg) fail('Usage: node scripts/google-play/publish-bundle.mjs <app.aab> [--commit] [--approve-publish] [--approve-production]');
const file = resolve(fileArg);
if (!existsSync(file) || !file.endsWith('.aab')) fail('A readable Android App Bundle (.aab) path is required.');
if (!allowedTracks.has(track)) fail('GOOGLE_PLAY_TRACK must be internal, alpha, beta or production.');
if (!allowedStatuses.has(releaseStatus)) fail('GOOGLE_PLAY_RELEASE_STATUS must be draft, inProgress, halted or completed.');
const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME;
if (!packageName || !/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(packageName)) fail('Set a valid GOOGLE_PLAY_PACKAGE_NAME.');
let account;
try { account = JSON.parse(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || '{}'); } catch { fail('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is invalid JSON.'); }
if (!account.client_email || !account.private_key) fail('Service-account client_email and private_key are required.');
const size = statSync(file).size;
if (size < 1) fail('The AAB file is empty.');
const committing = args.has('--commit');
if (committing && (process.env.GOOGLE_PLAY_PUBLISHING_ENABLED !== 'true' || !process.env.GOOGLE_PLAY_WRITE_APPROVAL_TOKEN || !args.has('--approve-publish'))) {
  fail('Commit requires GOOGLE_PLAY_PUBLISHING_ENABLED=true, GOOGLE_PLAY_WRITE_APPROVAL_TOKEN and --approve-publish.');
}
if (committing && track === 'production' && (process.env.GOOGLE_PLAY_PRODUCTION_PUBLISHING_ENABLED !== 'true' || !process.env.GOOGLE_PLAY_PRODUCTION_APPROVAL_TOKEN || !args.has('--approve-production'))) fail('Production publishing additionally requires GOOGLE_PLAY_PRODUCTION_PUBLISHING_ENABLED=true, GOOGLE_PLAY_PRODUCTION_APPROVAL_TOKEN and --approve-production.');
console.log(JSON.stringify({ mode: committing ? 'COMMIT' : 'DRY_RUN', packageName, track, releaseStatus, bundle: basename(file), sizeBytes: size, remoteChanges: committing }, null, 2));
if (!committing) {
  console.log('Dry run only. No Google API call or remote edit was made. Add --commit and the required approvals to execute.');
  process.exit(0);
}

function b64url(value) { return Buffer.from(value).toString('base64url'); }
async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: account.token_uri || 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const unsigned = header + '.' + claims;
  const signer = createSign('RSA-SHA256'); signer.update(unsigned); signer.end();
  const assertion = unsigned + '.' + signer.sign(account.private_key.replace(/\\n/g, '\n')).toString('base64url');
  const response = await fetch(account.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!response.ok) throw new Error('OAuth token exchange failed: HTTP ' + response.status);
  const json = await response.json();
  if (!json.access_token) throw new Error('OAuth response missing access_token');
  return json.access_token;
}
async function api(url, token, init = {}) {
  const response = await fetch(url, { ...init, headers: { authorization: 'Bearer ' + token, ...init.headers } });
  const body = await response.text();
  if (!response.ok) throw new Error('Google Play API HTTP ' + response.status + ': ' + body.slice(0, 600));
  return body ? JSON.parse(body) : {};
}
const root = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/' + encodeURIComponent(packageName);
const token = await accessToken();
let edit;
try {
  edit = await api(root + '/edits', token, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  if (!edit.id) throw new Error('Google Play did not return an edit ID.');
  const uploadUrl = 'https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/' +
    encodeURIComponent(packageName) + '/edits/' + encodeURIComponent(edit.id) + '/bundles?uploadType=media';
  const uploaded = await api(uploadUrl, token, {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream', 'content-length': String(size) },
    body: createReadStream(file),
    duplex: 'half',
  });
  if (!uploaded.versionCode) throw new Error('Bundle upload response did not contain a versionCode.');
  const release = {
    name: process.env.GOOGLE_PLAY_RELEASE_NAME || basename(file),
    versionCodes: [String(uploaded.versionCode)],
    status: releaseStatus,
  };
  if (process.env.GOOGLE_PLAY_RELEASE_NOTES) {
    release.releaseNotes = [{ language: process.env.GOOGLE_PLAY_RELEASE_LANGUAGE || 'en-US', text: process.env.GOOGLE_PLAY_RELEASE_NOTES }];
  }
  await api(root + '/edits/' + encodeURIComponent(edit.id) + '/tracks/' + encodeURIComponent(track), token, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ track, releases: [release] }),
  });
  const committed = await api(root + '/edits/' + encodeURIComponent(edit.id) + ':commit', token, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  });
  console.log(JSON.stringify({ success: true, packageName, track, versionCode: uploaded.versionCode, editId: edit.id, committed }, null, 2));
} catch (error) {
  console.error('Google Play publishing failed. The uncommitted edit, if created, may need manual cleanup in Play Console.');
  console.error(error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
}
