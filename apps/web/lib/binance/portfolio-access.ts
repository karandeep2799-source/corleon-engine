import { timingSafeEqual } from "node:crypto";

export function isAuthorizedPortfolioRequest(request: Request): boolean {
  const expected = process.env.BINANCE_PORTFOLIO_ACCESS_TOKEN;
  const authorization = request.headers.get("authorization") ?? "";
  if (!expected || !authorization.startsWith("Bearer ")) return false;
  const supplied = authorization.slice(7);
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}
