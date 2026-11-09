import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null });
  const user = await db.user.findUnique({ where: { id: session.userId }, select: { id: true, email: true, name: true, image: true } });
  return NextResponse.json({ user });
}
