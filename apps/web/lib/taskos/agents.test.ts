import { describe, expect, it } from 'vitest';
import { TASK_AGENTS } from './agents';
describe('TaskOS agent registry', () => {
  it('exposes unique stable agent identifiers', () => {
    expect(new Set(TASK_AGENTS).size).toBe(TASK_AGENTS.length);
    expect(TASK_AGENTS).toContain('planner');
    expect(TASK_AGENTS).toContain('qa');
  });
});
