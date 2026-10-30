import { NextResponse } from 'next/server';
import { runTaskJobBatch } from '@/lib/taskos/worker';
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== 'Bearer ' + secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await runTaskJobBatch('vercel-cron', 10);
  return NextResponse.json(result);
}
