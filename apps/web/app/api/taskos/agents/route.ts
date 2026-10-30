import { NextResponse } from 'next/server';
import { z } from 'zod';
import { TASK_AGENTS, runTaskAgent } from '@/lib/taskos/agents';
import { requireTaskOS } from '@/lib/taskos/security';
const schema = z.object({ agent: z.enum(TASK_AGENTS) });
export async function POST(request: Request) {
  try {
    const { tenantId, userId } = requireTaskOS(request), { agent } = schema.parse(await request.json());
    return NextResponse.json({ data: await runTaskAgent(tenantId, userId, agent) }, { status: 202 });
  } catch (e) { return NextResponse.json({ error: e instanceof z.ZodError ? e.flatten() : 'Unauthorized or failed' }, { status: e instanceof z.ZodError ? 400 : 401 }); }
}
