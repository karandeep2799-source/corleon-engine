import { db } from './db';

export const TASK_AGENTS = ['intake', 'planner', 'priority', 'deadline', 'research', 'github', 'qa', 'reporter'] as const;
export type TaskAgent = typeof TASK_AGENTS[number];

export async function runTaskAgent(tenantId: string, userId: string, agent: TaskAgent) {
  const run = await db.taskAgentRun.create({ data: { tenantId, userId, agent, input: { mode: 'autonomous', source: 'taskos' }, status: 'RUNNING', startedAt: new Date() } });
  try {
    let output: Record<string, unknown> = {};
    if (agent === 'priority' || agent === 'planner') {
      const tasks = await db.task.findMany({ where: { tenantId, ownerId: userId, status: { in: ['INBOX', 'TODO', 'IN_PROGRESS'] } }, orderBy: [{ dueAt: 'asc' }, { updatedAt: 'desc' }], take: 200 });
      const now = Date.now();
      const ranked = tasks.map(t => {
        const overdue = t.dueAt ? Math.max(0, now - t.dueAt.getTime()) : 0;
        const score = (t.priority === 'URGENT' ? 100 : t.priority === 'HIGH' ? 70 : t.priority === 'NORMAL' ? 40 : 10) + (overdue ? 50 : 0) + (t.status === 'IN_PROGRESS' ? 10 : 0);
        return { id: t.id, title: t.title, score, reason: overdue ? 'Overdue' : 'Priority and recency' };
      }).sort((a,b) => b.score-a.score);
      output = { ranked, count: ranked.length };
    } else if (agent === 'intake') {
      const count = await db.task.count({ where: { tenantId, ownerId: userId, status: 'INBOX' } });
      output = { inboxCount: count, recommendation: count > 0 ? 'Review and classify inbox tasks' : 'Inbox is clear' };
    } else if (agent === 'reporter') {
      const [open, done, overdue] = await Promise.all([
        db.task.count({ where: { tenantId, ownerId: userId, status: { in: ['INBOX','TODO','IN_PROGRESS','BLOCKED'] } } }),
        db.task.count({ where: { tenantId, ownerId: userId, status: 'DONE' } }),
        db.task.count({ where: { tenantId, ownerId: userId, status: { notIn: ['DONE','CANCELLED'] }, dueAt: { lt: new Date() } } })
      ]);
      output = { open, done, overdue, generatedAt: new Date().toISOString() };
    } else {
      output = { accepted: true, mode: 'adapter-required', message: 'Agent registered; connect a provider-specific adapter before enabling external execution.' };
    }
    await db.taskAgentRun.update({ where: { id: run.id }, data: { status: 'SUCCEEDED', output: output as object, finishedAt: new Date() } });
    return { id: run.id, agent, output };
  } catch (error) {
    await db.taskAgentRun.update({ where: { id: run.id }, data: { status: 'FAILED', error: error instanceof Error ? error.message : 'Unknown error', finishedAt: new Date() } });
    throw error;
  }
}
