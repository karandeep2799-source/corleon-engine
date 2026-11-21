export const DEFAULT_WALLET_ADDRESS = '0xd6eCCeBC1a33f10b432cd5896554182411D840dF';
const PRO_BASE = (process.env.BLOCKSCOUT_PRO_API_BASE_URL || 'https://api.blockscout.com').replace(/\/$/, '');
const CONFIG_URL = `${PRO_BASE}/api/json/config`;
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export type Chain = { id: string; name: string; nativeCurrency?: string; explorerUrl?: string; apiUrl?: string };
export type ChainPortfolio = {
  chain: Chain;
  address: string;
  nativeBalance: string | null;
  nativeSymbol: string;
  transactionCount: number | null;
  tokens: Array<{ address: string; name: string; symbol: string; decimals: number; balance: string; valueUsd: string | null; type?: string }>;
  error?: string;
};

export function validateAddress(value: string): string {
  if (!ADDRESS_RE.test(value)) throw new Error('A valid 0x-prefixed EVM address is required.');
  return value;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) if (typeof obj[key] === 'string' && obj[key]) return obj[key] as string;
  return undefined;
}

export function normalizeChains(raw: unknown): Chain[] {
  const root = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const candidates = Array.isArray(raw) ? raw : Array.isArray(root.chains) ? root.chains : Array.isArray(root.items) ? root.items : Object.values(root);
  const result = new Map<string, Chain>();
  for (const item of candidates) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const idValue = obj.chain_id ?? obj.chainId ?? obj.id ?? obj.chainID;
    if (idValue === undefined || idValue === null || !/^\d+$/.test(String(idValue))) continue;
    const id = String(idValue);
    const name = pickString(obj, ['name', 'title', 'chain_name']) || `EVM Chain ${id}`;
    const apiUrl = pickString(obj, ['api_url', 'apiUrl', 'url', 'explorer_url', 'explorerUrl']);
    const explorerUrl = pickString(obj, ['explorer_url', 'explorerUrl', 'url']);
    const nativeCurrency = pickString(obj, ['native_currency_symbol', 'nativeCurrencySymbol', 'currency_symbol', 'symbol']);
    result.set(id, { id, name, apiUrl: apiUrl?.replace(/\/$/, ''), explorerUrl, nativeCurrency });
  }
  return [...result.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getSupportedChains(): Promise<Chain[]> {
  const response = await fetch(CONFIG_URL, { headers: { accept: 'application/json' }, next: { revalidate: 300 } });
  if (!response.ok) throw new Error(`Blockscout chain registry unavailable (${response.status}).`);
  const chains = normalizeChains(await response.json());
  if (!chains.length) throw new Error('Blockscout returned no recognizable supported chains.');
  return chains;
}

function headers(): HeadersInit {
  const key = process.env.BLOCKSCOUT_PRO_API_KEY;
  return key ? { accept: 'application/json', authorization: `Bearer ${key}` } : { accept: 'application/json' };
}

async function requestJson(url: string, pro: boolean): Promise<any> {
  const response = await fetch(url, {
    headers: pro ? headers() : { accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Explorer request failed (${response.status}).`);
  return response.json();
}

async function getEndpoint(chain: Chain, path: string): Promise<any> {
  const key = process.env.BLOCKSCOUT_PRO_API_KEY;
  if (key) {
    try {
      return await requestJson(`${PRO_BASE}/${encodeURIComponent(chain.id)}/api/v2/${path}`, true);
    } catch (error) {
      if (process.env.BLOCKSCOUT_PUBLIC_FALLBACK !== 'true' || !chain.apiUrl) throw error;
    }
  }
  if (process.env.BLOCKSCOUT_PUBLIC_FALLBACK === 'false' || !chain.apiUrl) {
    throw new Error('No usable Blockscout API configured for this chain. Configure BLOCKSCOUT_PRO_API_KEY or enable a public explorer fallback.');
  }
  return requestJson(`${chain.apiUrl}/api/v2/${path}`, false);
}

export async function getChainPortfolio(chain: Chain, addressInput: string): Promise<ChainPortfolio> {
  const address = validateAddress(addressInput);
  try {
    const [account, tokenData] = await Promise.all([
      getEndpoint(chain, `addresses/${address}`),
      getEndpoint(chain, `addresses/${address}/tokens`),
    ]);
    const items = Array.isArray(tokenData) ? tokenData : Array.isArray(tokenData?.items) ? tokenData.items : [];
    const tokens = items.map((entry: any) => {
      const token = entry.token || entry;
      return {
        address: String(token.address_hash || token.address || ''),
        name: String(token.name || 'Unknown token'),
        symbol: String(token.symbol || '—'),
        decimals: Number(token.decimals ?? 0),
        balance: String(entry.value ?? entry.balance ?? '0'),
        valueUsd: entry.value_usd == null ? null : String(entry.value_usd),
        type: token.type ? String(token.type) : undefined,
      };
    });
    return {
      chain,
      address,
      nativeBalance: account.coin_balance == null ? null : String(account.coin_balance),
      nativeSymbol: chain.nativeCurrency || 'Native',
      transactionCount: Number.isFinite(Number(account.transactions_count)) ? Number(account.transactions_count) : null,
      tokens,
    };
  } catch (error) {
    return { chain, address, nativeBalance: null, nativeSymbol: chain.nativeCurrency || 'Native', transactionCount: null, tokens: [], error: error instanceof Error ? error.message : 'Explorer unavailable' };
  }
}

export async function getAddressTransactions(chain: Chain, addressInput: string, page?: string): Promise<unknown> {
  const address = validateAddress(addressInput);
  const params = new URLSearchParams();
  if (page) {
    let decoded: unknown;
    try { decoded = JSON.parse(page); } catch { throw new Error('Invalid transaction pagination cursor.'); }
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) throw new Error('Invalid transaction pagination cursor.');
    const allowed = new Set(['block_number', 'index', 'items_count', 'fee', 'hash', 'inserted_at', 'value', 'filter']);
    for (const [key, value] of Object.entries(decoded as Record<string, unknown>)) {
      if (allowed.has(key) && (typeof value === 'string' || typeof value === 'number')) params.set(key, String(value));
    }
  }
  return getEndpoint(chain, `addresses/${address}/transactions${params.size ? `?${params}` : ''}`);
}
