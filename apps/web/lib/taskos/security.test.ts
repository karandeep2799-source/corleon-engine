import { afterEach, describe, expect, it } from 'vitest';
import { signState, verifyState } from './security';

afterEach(() => { delete process.env.TASKOS_STATE_SECRET; });

describe('TaskOS signed OAuth state primitive', () => {
  it('accepts an intact signed payload', () => {
    process.env.TASKOS_STATE_SECRET = 'a'.repeat(48);
    const payload = 'opaque-state-payload';
    expect(verifyState(payload, signState(payload))).toBe(true);
  });
  it('rejects a modified payload', () => {
    process.env.TASKOS_STATE_SECRET = 'b'.repeat(48);
    const signature = signState('expected');
    expect(verifyState('tampered', signature)).toBe(false);
  });
  it('requires a sufficiently strong secret', () => {
    process.env.TASKOS_STATE_SECRET = 'short';
    expect(() => signState('x')).toThrow();
  });
});
