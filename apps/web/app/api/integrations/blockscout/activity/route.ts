import { NextRequest, NextResponse } from 'next/server';
import { getAddressTransactions, getSupportedChains, validateAddress } from '@/lib/blockscout/client';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const addressParam = request.nextUrl.searchParams.get('address') || process.env.BLOCKSCOUT_DEFAULT_ADDRESS;
  const chainId = request.nextUrl.searchParams.get('chainId');
  if (!addressParam || !chainId || !/^\d+$/.test(chainId)) {
    return NextResponse.json({ error: 'address and numeric chainId are required.' }, { status: 400 });
  }
  try {
    const address = validateAddress(addressParam);
    const chains = await getSupportedChains();
    const chain = chains.find(item => item.id === chainId);
    if (!chain) return NextResponse.json({ error: 'Unsupported Blockscout chain.' }, { status: 404 });
    const page = request.nextUrl.searchParams.get('cursor') || undefined;
    const activity = await getAddressTransactions(chain, address, page);
    return NextResponse.json({ address, chain, activity, readOnly: true }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Activity request failed' }, { status: 502 });
  }
}
