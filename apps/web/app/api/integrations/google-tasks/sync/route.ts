import { NextResponse } from 'next/server';
import { requireTaskOS } from '@/lib/taskos/security';
import { syncGoogleToCorleon } from '@/lib/taskos/google';
export async function POST(request: Request) {
  try { const { tenantId, userId } = requireTaskOS(request); return NextResponse.json({ data: await syncGoogleToCorleon(tenantId, userId) }); }
  catch { return NextResponse.json({ error: 'Unauthorized or sync failed' }, { status: 401 }); }
}
