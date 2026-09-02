import { handleStripeWebhook } from '../../src/cashflow/stripe-webhook.js';

export const config = {
  api: { bodyParser: false }
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers['stripe-signature'];
    if (!signature) return res.status(400).json({ error: 'Missing stripe-signature' });

    const result = await handleStripeWebhook(rawBody, signature);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error('Stripe webhook failed', error);
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Webhook processing failed' });
  }
}
