import { hashPurchaseToken, persistPurchase, prisma } from './store.js';
import { googlePlay } from './client.js';
interface PubSubPush { message?: { messageId?: string; data?: string; publishTime?: string }; subscription?: string; }
async function verifyPubSubOidc(request: Request) {
  const audience = process.env.GOOGLE_PLAY_PUBSUB_AUDIENCE;
  const expectedEmail = process.env.GOOGLE_PLAY_PUBSUB_SERVICE_ACCOUNT_EMAIL;
  const match = (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  if (!audience || !expectedEmail || !match) return false;
  const response = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(match[1]), { cache: 'no-store' });
  if (!response.ok) return false;
  const claims = await response.json() as Record<string, string>;
  return (claims.iss === 'accounts.google.com' || claims.iss === 'https://accounts.google.com') && claims.aud === audience && claims.email === expectedEmail && claims.email_verified === 'true';
}
export async function processRtdn(request: Request) {
  if (!(await verifyPubSubOidc(request))) return { status: 401, body: { error: 'Invalid Pub/Sub push identity' } };
  const envelope = await request.json() as PubSubPush;
  const messageId = envelope.message?.messageId;
  const encoded = envelope.message?.data;
  if (!messageId || !encoded) return { status: 400, body: { error: 'Malformed Pub/Sub envelope' } };
  const previous = await prisma.googlePlayNotification.findUnique({ where: { messageId } });
  if (previous?.processingStatus === 'PROCESSED') return { status: 200, body: { ok: true, duplicate: true } };
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as Record<string, unknown>; }
  catch { return { status: 400, body: { error: 'Invalid RTDN payload' } }; }
  const packageName = typeof payload.packageName === 'string' ? payload.packageName : '';
  if (!packageName || packageName !== (process.env.GOOGLE_PLAY_PACKAGE_NAME || '')) return { status: 400, body: { error: 'RTDN package name does not match configured application' } };
  const subscription = payload.subscriptionNotification as Record<string, unknown> | undefined;
  const oneTime = payload.oneTimeProductNotification as Record<string, unknown> | undefined;
  const token = typeof subscription?.purchaseToken === 'string' ? subscription.purchaseToken : typeof oneTime?.purchaseToken === 'string' ? oneTime.purchaseToken : undefined;
  const type = subscription?.notificationType ?? oneTime?.notificationType ?? (payload.testNotification ? 'TEST' : 'UNKNOWN');
  const millis = typeof payload.eventTimeMillis === 'string' ? Number(payload.eventTimeMillis) : NaN;
  const eventTime = Number.isFinite(millis) ? new Date(millis) : undefined;
  const notificationData = { packageName, notificationType: String(type), eventTime, purchaseTokenHash: token ? hashPurchaseToken(token) : undefined };
  try {
    if (token && subscription) {
      const data = await googlePlay.subscription(packageName, token);
      await persistPurchase({ packageName, token, kind: 'SUBSCRIPTION', data });
    } else if (token && oneTime && typeof oneTime.sku === 'string') {
      const data = await googlePlay.productPurchase(packageName, oneTime.sku, token);
      await persistPurchase({ packageName, token, kind: 'PRODUCT', productId: oneTime.sku, data });
    }
    await prisma.googlePlayNotification.upsert({
      where: { messageId },
      create: { messageId, ...notificationData, processingStatus: 'PROCESSED', processedAt: new Date() },
      update: { ...notificationData, processingStatus: 'PROCESSED', processedAt: new Date(), errorCode: null },
    });
    return { status: 200, body: { ok: true } };
  } catch (error) {
    await prisma.googlePlayNotification.upsert({
      where: { messageId },
      create: { messageId, ...notificationData, processingStatus: 'FAILED', errorCode: error instanceof Error ? error.name : 'ProcessingError' },
      update: { ...notificationData, processingStatus: 'FAILED', errorCode: error instanceof Error ? error.name : 'ProcessingError' },
    }).catch(() => undefined);
    throw error;
  }
}