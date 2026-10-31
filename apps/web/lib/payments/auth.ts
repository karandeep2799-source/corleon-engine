import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import type { PaymentActor } from './domain';

/**
 * Auth bridge: validates the application's HS256 session JWT cookie.
 * Configure PAYMENT_SESSION_COOKIE and AUTH_SECRET to match the app's session issuer.
 * Fail closed when no verified application session is present.
 */
export function getPaymentActor(request: NextRequest): PaymentActor | null {
  const secret = process.env.AUTH_SECRET;
  const cookieName = process.env.PAYMENT_SESSION_COOKIE || 'corleon_session';
  if (!secret) return null;
  const token = request.cookies.get(cookieName)?.value;
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  try {
    const decodedHeader = JSON.parse(Buffer.from(header, 'base64url').toString('utf8')) as { alg?: string };
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: string; exp?: number; iss?: string;
    };
    if (decodedHeader.alg !== 'HS256' || !claims.sub || !claims.exp || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    if (process.env.PAYMENT_SESSION_ISSUER && claims.iss !== process.env.PAYMENT_SESSION_ISSUER) return null;
    const expected = createHmac('sha256', secret).update(`${header}.${payload}`).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    return { userId: claims.sub };
  } catch {
    return null;
  }
}

export function assertSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const expected = new URL(request.url).origin;
    return new URL(origin).origin === expected;
  } catch {
    return false;
  }
}
