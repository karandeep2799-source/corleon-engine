import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyGoogleIdToken } from "@/lib/google-id-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const SESSION_COOKIE = "__Host-corleon_session";
const CSRF_COOKIE = "__Host-corleon-csrf";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function isUniqueConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Cross-origin sign-in is not allowed." }, { status: 403 });
  }

  const csrfCookie = request.cookies.get(CSRF_COOKIE)?.value;
  const csrfHeader = request.headers.get("x-csrf-token");
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return NextResponse.json({ error: "Invalid or expired sign-in request. Reload and try again." }, { status: 403 });
  }

  let body: { credential?: unknown };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (typeof body.credential !== "string" || body.credential.length < 100 || body.credential.length > 12_000) {
    return NextResponse.json({ error: "A valid Google credential is required." }, { status: 400 });
  }

  let identity;
  try {
    identity = await verifyGoogleIdToken(body.credential, csrfHeader);
  } catch {
    return NextResponse.json({ error: "Google sign-in could not be verified. Check the OAuth client configuration and try again." }, { status: 401 });
  }

  let account = await prisma.googleAccount.findUnique({
    where: { googleSub: identity.sub },
    select: { userId: true },
  });
  let userId = account?.userId;

  if (!userId) {
    let user = await prisma.user.findUnique({ where: { email: identity.email } });
    if (!user) {
      try {
        user = await prisma.user.create({ data: { email: identity.email, name: identity.name ?? null } });
      } catch (error) {
        if (!isUniqueConflict(error)) throw error;
        user = await prisma.user.findUnique({ where: { email: identity.email } });
      }
    }
    if (!user) return NextResponse.json({ error: "Unable to provision the Corleon user." }, { status: 500 });

    const existingGoogleLink = await prisma.googleAccount.findUnique({ where: { userId: user.id } });
    if (existingGoogleLink && existingGoogleLink.googleSub !== identity.sub) {
      return NextResponse.json({ error: "This Corleon account is already linked to another Google identity. Contact an administrator." }, { status: 409 });
    }

    try {
      await prisma.googleAccount.create({
        data: { googleSub: identity.sub, userId: user.id, email: identity.email },
      });
      userId = user.id;
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
      account = await prisma.googleAccount.findUnique({ where: { googleSub: identity.sub }, select: { userId: true } });
      if (!account) return NextResponse.json({ error: "Google identity is already linked to another account." }, { status: 409 });
      userId = account.userId;
    }
  }

  const rawSessionToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawSessionToken).digest("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await prisma.session.create({ data: { tokenHash, userId, expiresAt } });

  const response = NextResponse.json({ authenticated: true, redirectTo: "/" }, {
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
  response.cookies.set(SESSION_COOKIE, rawSessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  response.cookies.set(CSRF_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
