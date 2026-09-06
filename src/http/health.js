import { createLogger } from '../observability/logger.js';

const logger = createLogger({ component: 'health' });

export function liveness(req, res) {
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ status: 'ok', service: 'corleon-engine', timestamp: new Date().toISOString() }));
}

export async function readiness(req, res, { checks = [] } = {}) {
  const results = {};
  let healthy = true;
  for (const check of checks) {
    try { results[check.name] = await check.run(); }
    catch (error) { healthy = false; results[check.name] = { ok: false, error: error.message }; logger.error('readiness check failed', { check: check.name, error: error.message }); }
  }
  res.statusCode = healthy ? 200 : 503;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ status: healthy ? 'ready' : 'not_ready', checks: results, timestamp: new Date().toISOString() }));
}
