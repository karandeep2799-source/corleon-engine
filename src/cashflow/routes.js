import { executePayout } from './payout-service.js';
import { createPayout, releaseHeldCommissions } from './engine.js';

export async function requestPayout(req, res) {
  try {
    const { organizationId, affiliateId, payoutAccountId, method, currency } = req.body;
    const payout = await createPayout({ organizationId, affiliateId, payoutAccountId, method, currency });
    const executed = await executePayout(payout.id);
    return res.status(201).json(executed);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function releaseCommissions(req, res) {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    return res.json(await releaseHeldCommissions());
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}
