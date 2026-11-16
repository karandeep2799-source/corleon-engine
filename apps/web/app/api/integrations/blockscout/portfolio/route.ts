import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_WALLET_ADDRESS, getChainPortfolio, getSupportedChains, validateAddress } from '../../../../../lib/blockscout/client';

export const runtime = 'nodejs';
export const maxDuration = 60;

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(request: NextRequest): boolean {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  if (hits.size > 10_000) { for (const [key, value] of hits) if (value.resetAt <= now) hits.delete(key); }
  const current = hits.get(forwarded);
  if (!current || current.resetAt <= now) {
    hits.set(forwarded, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > MAX_REQUESTS;
}

export async function GET(request: NextRequest) {
  if (rateLimited(request)) return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  const addressParam = request.nextUrl.searchParams.get('address') || process.env.BLOCKSCOUT_DEFAULT_ADDRESS || DEFAULT_WALLET_ADDRESS;
  let address: string;
  try { address = validateAddress(addressParam); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid address' }, { status: 400 }); }

  try {
    const allChains = await getSupportedChains();
    const requested = request.nextUrl.searchParams.get('chains');
    const selectedIds = requested ? new Set(requested.split(',').filter(id => /^\d+$/.test(id)).slice(0, 120)) : null;
    const selected = selectedIds ? allChains.filter(chain => selectedIds.has(chain.id)) : allChains;
    if (!selected.length) return NextResponse.json({ error: 'No supported chains matched the request.' }, { status: 400 });

    const results = [];
    for (let i = 0; i < selected.length; i += 6) {
      const batch = selected.slice(i, i + 6);
      results.push(...await Promise.all(batch.map(chain => getChainPortfolio(chain, address))));
    }
    return NextResponse.json({
      address,
      generatedAt: new Date().toISOString(),
      supportedChainCount: allChains.length,
      queriedChainCount: results.length,
      chains: results,
      totals: {
        chainsWithActivity: results.filter(item => item.nativeBalance !== null || item.tokens.length > 0).length,
        tokenCount: results.reduce((sum, item) => sum + item.tokens.length, 0),
        transactionCount: results.reduce((sum, item) => sum + (item.transactionCount || 0), 0),
      },
      readOnly: true,
    }, { headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Portfolio request failed' }, { status: 502 });
  }
}
