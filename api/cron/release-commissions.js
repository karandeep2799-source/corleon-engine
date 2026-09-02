import { releaseHeldCommissions } from '../../src/cashflow/engine.js';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = req.headers.authorization;
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
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
