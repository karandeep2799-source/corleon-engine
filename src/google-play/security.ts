import { timingSafeEqual } from 'node:crypto';
function equal(left: string, right: string) { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); }
export function isGooglePlayAdminRequest(request: Request) {
  const expected = process.env.GOOGLE_PLAY_ADMIN_TOKEN;
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  return Boolean(expected && supplied && equal(expected, supplied));
}
export function hasWriteApproval(request: Request) {
  const expected = process.env.GOOGLE_PLAY_WRITE_APPROVAL_TOKEN;
  const supplied = request.headers.get('x-google-play-approval') || '';
  return Boolean(expected && supplied && equal(expected, supplied));
}
export const isPublishingApproved = (request: Request) => process.env.GOOGLE_PLAY_PUBLISHING_ENABLED === 'true' && hasWriteApproval(request);
export const isSupportWriteApproved = (request: Request) => process.env.GOOGLE_PLAY_SUPPORT_WRITES_ENABLED === 'true' && hasWriteApproval(request);
export function isProductionPublishingApproved(request: Request) {
  const expected = process.env.GOOGLE_PLAY_PRODUCTION_APPROVAL_TOKEN;
  const supplied = request.headers.get('x-google-play-production-approval') || '';
  return process.env.GOOGLE_PLAY_PRODUCTION_PUBLISHING_ENABLED === 'true' && Boolean(expected && supplied && equal(expected, supplied));
}