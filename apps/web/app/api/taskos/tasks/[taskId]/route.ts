import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/taskos/db';
import { requireTaskOS } from '@/lib/taskos/security';
const patchSchema = z.object({ title: z.string().trim().min(1).max(300).optional(), notes: z.string().max(10000).nullable().optional(), status: z.enum(['INBOX','TODO','IN_PROGRESS','BLOCKED','DONE','CANCELLED']).optional(), priority: z.enum(['LOW','NORMAL','HIGH','URGENT']).optional(), dueAt: z.string().datetime().nullable().optional() });
export async function PATCH(request: Request, context: { params: Promise<{ taskId: string }> }) {
  try {
    const { tenantId, userId } = requireTaskOS(request), { taskId } = await context.params, body = patchSchema.parse(await request.json());
    const existing = await db.task.findFirst({ where: { id: taskId, tenantId, ownerId: userId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const task = await db.task.update({ where: { id: taskId }, data: { ...body, dueAt: body.dueAt === undefined ? undefined : body.dueAt ? new Date(body.dueAt) : null, completedAt: body.status === 'DONE' ? new Date() : body.status ? null : undefined } });
    await db.taskAuditEvent.create({ data: { tenantId, actorId: userId, action: 'task.updated', resource: 'task', resourceId: task.id } });
    return NextResponse.json({ data: task });
  } catch (e) { return NextResponse.json({ error: e instanceof z.ZodError ? e.flatten() : 'Unauthorized or invalid request' }, { status: e instanceof z.ZodError ? 400 : 401 }); }
}
export async function DELETE(request: Request, context: { params: Promise<{ taskId: string }> }) {
  try {
    const { tenantId, userId } = requireTaskOS(request), { taskId } = await context.params;
    const result = await db.task.deleteMany({ where: { id: taskId, tenantId, ownerId: userId, source: 'CORLEON' } });
    return result.count ? NextResponse.json({ deleted: true }) : NextResponse.json({ error: 'Not found or externally managed' }, { status: 404 });
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
}
