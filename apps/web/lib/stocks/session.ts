import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE = "corleon_stocks_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
type StockSession = { email: string; name: string; picture?: string; exp: number; iat: number };

function requiredSecret(name: string): string {
  const value = process.env[name];
  if (!value || value.length < 32) throw new Error(`${name} must be configured with at least 32 characters.`);
  return value;
}
function base64url(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}
function signature(value: string): Buffer {
  return createHmac("sha256", requiredSecret("STOCKS_SESSION_SECRET")).update(value).digest();
}
function encryptionKey(): Buffer {
  const raw = process.env.STOCKS_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("STOCKS_TOKEN_ENCRYPTION_KEY is not configured.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("STOCKS_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  return key;
}
export function createStockSessionToken(profile: { email: string; name?: string; picture?: string }): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: StockSession = {
    email: profile.email.toLowerCase(),
    name: profile.name?.slice(0, 120) || profile.email,
    picture: profile.picture?.slice(0, 500),
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${signature(encoded).toString("base64url")}`;
}
export async function getStockSession(): Promise<StockSession | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [payload, signed, extra] = token.split(".");
  if (!payload || !signed || extra) return null;
  try {
    const actual = Buffer.from(signed, "base64url");
    const expected = signature(payload);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as StockSession;
    const now = Math.floor(Date.now() / 1000);
    if (!value.email || value.exp <= now || value.iat > now + 60) return null;
    return value;
  } catch {
    return null;
  }
}
export function setStockSessionCookie(response: Response, profile: { email: string; name?: string; picture?: string }): Response {
  const token = createStockSessionToken(profile);
  const headers = new Headers(response.headers);
  headers.append("Set-Cookie", `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
export function clearStockSessionCookie(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.append("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
export function encryptRefreshToken(value: string): string {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}
export function decryptRefreshToken(value: string): string {
  const [ivText, tagText, bodyText] = value.split(".");
  if (!ivText || !tagText || !bodyText) throw new Error("Stored Gmail token has an invalid format.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(bodyText, "base64url")), decipher.final()]).toString("utf8");
}
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
export const stockSessionCookieName = SESSION_COOKIE;
