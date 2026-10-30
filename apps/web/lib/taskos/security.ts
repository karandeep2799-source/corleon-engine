import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

function key() {
  const raw = process.env.TASKOS_ENCRYPTION_KEY;
  if (!raw || !/^[a-f0-9]{64}$/i.test(raw)) throw new Error('TASKOS_ENCRYPTION_KEY must be 32 bytes encoded as 64 hex characters');
  return Buffer.from(raw, 'hex');
}
export function encryptSecret(value: string) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}
export function decryptSecret(value: string) {
  const [iv, tag, body] = value.split('.');
  if (!iv || !tag || !body) throw new Error('Malformed encrypted secret');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8');
}
export function signState(payload: string) {
  const secret = process.env.TASKOS_STATE_SECRET;
  if (!secret || secret.length < 32) throw new Error('TASKOS_STATE_SECRET must be at least 32 characters');
  return createHmac('sha256', secret).update(payload).digest('base64url');
}
export function verifyState(payload: string, signature: string) {
  const expected = Buffer.from(signState(payload));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function requireTaskOS(request: Request) {
  const expected = process.env.TASKOS_API_TOKEN;
  const auth = request.headers.get('authorization') ?? '';
  if (!expected || !auth.startsWith('Bearer ')) throw new Error('Unauthorized');
  const actual = Buffer.from(auth.slice(7)), secret = Buffer.from(expected);
  if (actual.length !== secret.length || !timingSafeEqual(actual, secret)) throw new Error('Unauthorized');
  return { tenantId: process.env.TASKOS_TENANT_ID ?? 'default', userId: process.env.TASKOS_USER_ID ?? 'system' };
}
export function requestId(request: Request) { return request.headers.get('x-request-id')?.slice(0, 100) ?? crypto.randomUUID(); }
