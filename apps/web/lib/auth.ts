import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const COOKIE_NAME = '__Host-corleon_session';

function sessionKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be configured with at least 32 characters');
  return new TextEncoder().encode(secret);
}

export async function getSession() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionKey(), { algorithms: ['HS256'], issuer: 'corleon-trade' });
    if (typeof payload.sub !== 'string') return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  return session;
}

export { COOKIE_NAME, sessionKey };
