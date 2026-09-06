export class IdempotencyConflictError extends Error {
  constructor(key) {
    super(`Idempotency key conflict: ${key}`);
    this.name = 'IdempotencyConflictError';
  }
}

export function requireIdempotencyKey(value) {
  if (typeof value !== 'string' || value.length < 16 || value.length > 128) {
    throw new Error('A 16-128 character idempotency key is required');
  }
  return value;
}

export function idempotencyFingerprint(payload) {
  return JSON.stringify(payload, Object.keys(payload ?? {}).sort());
}
