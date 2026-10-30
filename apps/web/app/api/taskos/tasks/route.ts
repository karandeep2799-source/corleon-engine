import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/taskos/db';
import { requireTaskOS, requestId } from '@/lib/taskos/security';

const createSchema = z.object({ title: z.string().trim().min(1).max(300), notes: z.string().max(10000).optional(), dueAt: z.string().datetime().optional(), priority: z.enum(['LOW','NORMAL','HIGH','URGENT']).optional(), labels: z.array(z.string().max(40)).max(20).optional() });
export async function GET(request: Request) {
  try {
    const { tenantId, userId } = requireTaskOS(request);
    const url = new URL(request.url), status = url.searchParams.get('status');
    const tasks = await db.task.findMany({ where: { tenantId, ownerId: userId, ...(status ? { status: status as never } : {}) }, orderBy: [{ dueAt: 'asc' }, { position: 'asc' }], take: Math.min(Number(url.searchParams.get('limit') ?? 100), 200) });
    return NextResponse.json({ data: tasks, requestId: requestId(request) });
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
}
export async function POST(request: Request) {
  try {
    const { tenantId, userId } = requireTaskOS(request);
    const body = createSchema.parse(await request.json());
    await db.taskUser.upsert({ where: { id: userId }, create: { id: userId, tenantId }, update: {} });
    const task = await db.task.create({ data: { tenantId, ownerId: userId, title: body.title, notes: body.notes, dueAt: body.dueAt ? new Date(body.dueAt) : null, priority: body.priority, labels: body.labels ?? [] } });
    await db.taskAuditEvent.create({ data: { tenantId, actorId: userId, action: 'task.created', resource: 'task', resourceId: task.id, requestId: requestId(request) } });
    return NextResponse.json({ data: task }, { status: 201 });
  } catch (e) { return NextResponse.json({ error: e instanceof z.ZodError ? e.flatten() : 'Request failed' }, { status: e instanceof z.ZodError ? 400 : 401 }); }
}
