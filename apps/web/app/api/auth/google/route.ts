import { NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { SignJWT } from 'jose';
import { z } from 'zod';
import { db } from '@/lib/db';
import { COOKIE_NAME, sessionKey } from '@/lib/auth';
import { MARKETS } from '@/lib/trading/types';

export const runtime = 'nodejs';
const bodySchema = z.object({ credential: z.string().min(20).max(10000) });
const client = new OAuth2Client();

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (!origin || new URL(origin).origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });
    }
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid credential payload' }, { status: 400 });
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return NextResponse.json({ error: 'Google sign-in is not configured' }, { status: 503 });

    const ticket = await client.verifyIdToken({ idToken: parsed.data.credential, audience: clientId });
    const claims = ticket.getPayload();
    if (!claims?.sub || !claims.email || claims.email_verified !== true) {
      return NextResponse.json({ error: 'Google identity is not verified' }, { status: 401 });
    }

    const user = await db.user.upsert({
      where: { email: claims.email.toLowerCase() },
      update: { name: claims.name ?? undefined, image: claims.picture ?? undefined },
      create: { email: claims.email.toLowerCase(), name: claims.name, image: claims.picture },
      select: { id: true, email: true, name: true },
    });

    await db.$transaction(async (tx) => {
      const account = await tx.tradingAccount.findFirst({ where: { userId: user.id } });
      if (!account) await tx.tradingAccount.create({ data: { userId: user.id, name: 'Primary account', baseCurrency: 'USD' } });
      await Promise.all(MARKETS.map((market) => tx.riskLimit.upsert({
        where: { userId_market: { userId: user.id, market } },
        update: {},
        create: { userId: user.id, market, tradingEnabled: false, requireLimitOrders: true, maxOpenOrders: 10 },
      })));
    });

    const token = await new SignJWT({ email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuer('corleon-trade')
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(sessionKey());

    const response = NextResponse.json({ user });
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8,
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }
}
