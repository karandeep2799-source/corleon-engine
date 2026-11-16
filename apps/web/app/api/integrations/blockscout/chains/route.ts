import { NextResponse } from 'next/server';
import { getSupportedChains } from '@/lib/blockscout/client';

export const runtime = 'nodejs';
export const revalidate = 300;

export async function GET() {
  try {
    const chains = await getSupportedChains();
    return NextResponse.json({ chains, count: chains.length, source: 'Blockscout supported-chain registry' }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load supported chains' }, { status: 502 });
  }
}
