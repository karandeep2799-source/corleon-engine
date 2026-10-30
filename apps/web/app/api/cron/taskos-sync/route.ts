import { NextResponse } from 'next/server';
import { db } from '@/lib/taskos/db';
import { syncGoogleToCorleon } from '@/lib/taskos/google';
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== 'Bearer ' + secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const connections = await db.googleTasksConnection.findMany({ select: { tenantId: true, userId: true } });
  const results = await Promise.allSettled(connections.map(c => syncGoogleToCorleon(c.tenantId, c.userId)));
  return NextResponse.json({ connections: connections.length, succeeded: results.filter(r => r.status === 'fulfilled').length, failed: results.filter(r => r.status === 'rejected').length });
}
