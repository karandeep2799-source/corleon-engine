import { timingSafeEqual } from 'node:crypto';
import { executePayout } from './payout-service.js';
import { createPayout, releaseHeldCommissions } from './engine.js';

const FINANCE_ROLES = new Set(['OWNER', 'ADMIN', 'FINANCE']);

function financeContext(req) {
  const auth = req.auth;
  if (!auth?.organizationId || !FINANCE_ROLES.has(auth.role)) return null;
  return { organizationId: auth.organizationId };
}

export async function requestPayout(req, res) {
  const context = financeContext(req);
  if (!context) return res.status(401).json({ error: 'An authenticated organization finance session is required.' });

  const { affiliateId, payoutAccountId, method, currency } = req.body ?? {};
  if (!affiliateId || !payoutAccountId || !method || !currency) {
    return res.status(400).json({ error: 'Affiliate, verified payout account, method, and currency are required.' });
  }

  try {
    const payout = await createPayout({
      organizationId: context.organizationId,
      affiliateId,
      payoutAccountId,
      method,
      currency
    });

    if (process.env.PAYOUT_EXECUTION_ENABLED !== 'true') {
      return res.status(202).json({
        id: payout.id,
        status: payout.status,
        message: 'Payout request recorded. External execution is disabled pending approval.'
      });
    }

    const executed = await executePayout(payout.id);
    return res.status(executed.status === 'PAID' ? 200 : 202).json(executed);
  } catch (error) {
    console.error('Payout request failed', error instanceof Error ? error.name : 'UnknownError');
    return res.status(409).json({ error: 'Payout request could not be completed. Check its status before retrying.' });
  }
}

export async function releaseCommissions(req, res) {
  const secret = process.env.CRON_SECRET;
  const authorization = req.headers.authorization ?? '';
  if (!secret) return res.status(503).json({ error: 'Scheduled commission release is not configured.' });

  const expected = Buffer.from('Bearer ' + secret, 'utf8');
  const actual = Buffer.from(authorization, 'utf8');
  const authorized = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!authorized) return res.status(401).json({ error: 'Unauthorized' });

  try {
    return res.json(await releaseHeldCommissions());
  } catch (error) {
    console.error('Commission release failed', error instanceof Error ? error.name : 'UnknownError');
    return res.status(500).json({ error: 'Commission release failed.' });
  }
}
