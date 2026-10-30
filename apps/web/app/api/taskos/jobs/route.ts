import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/taskos/db';
import { requireTaskOS } from '@/lib/taskos/security';
const schema = z.object({ kind: z.literal('google.tasks.sync'), idempotencyKey: z.string().min(12).max(180) });
export async function POST(request: Request) {
  try {
    const { tenantId, userId } = requireTaskOS(request), body = schema.parse(await request.json());
    const job = await db.taskJob.upsert({ where: { idempotencyKey: body.idempotencyKey }, create: { tenantId, kind: body.kind, payload: { userId }, idempotencyKey: body.idempotencyKey }, update: {} });
    return NextResponse.json({ data: { id: job.id, status: job.status } }, { status: 202 });
  } catch (error) { return NextResponse.json({ error: error instanceof z.ZodError ? error.flatten() : 'Unauthorized or invalid job' }, { status: error instanceof z.ZodError ? 400 : 401 }); }
}
