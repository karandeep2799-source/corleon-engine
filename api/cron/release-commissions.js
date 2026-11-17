import { timingSafeEqual } from 'node:crypto';
import { releaseHeldCommissions } from '../../src/cashflow/engine.js';

function isAuthorized(authorization, secret) {
  if (!secret || typeof authorization !== 'string') return false;

  const expected = Buffer.from(`Bearer ${secret}`, 'utf8');
  const actual = Buffer.from(authorization, 'utf8');

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Fail closed: never release commissions when the cron secret is missing or invalid.
  if (!isAuthorized(req.headers.authorization, process.env.CRON_SECRET)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await releaseHeldCommissions();
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error('Commission release failed', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Release failed' });
  }
}
