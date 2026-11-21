const PRO_API_BASE = "https://api.blockscout.com";
const CHAINS_METADATA_BASE = "https://chains.blockscout.com/api/chains";
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const MAX_CURSOR_LENGTH = 2048;

export type SupportedChain = { id: string; name: string; isTestnet: boolean; explorerUrl: string | null; nativeCurrencySymbol: string | null };
export type TokenHolding = { address: string; name: string; symbol: string; decimals: number; balance: string; valueUsd: string | null };
export type ChainPortfolio = { chain: SupportedChain; nativeBalance: string | null; transactionCount: number | null; tokens: TokenHolding[]; error?: string };

export function validateAddress(value: string): string {
  const address = value.trim();
  if (!ADDRESS_PATTERN.test(address)) throw new Error("Enter a valid 0x-prefixed EVM wallet address.");
  return address;
}
function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function firstString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}
function safeHttpsUrl(value: string | null): string | null {
  if (!value) return null;
  try { const parsed = new URL(value); return parsed.protocol === "https:" ? parsed.origin : null; }
  catch { return null; }
}

export function normalizeSupportedChains(config: unknown, metadata: unknown): SupportedChain[] {
  const chainConfig = asRecord(asRecord(config).chains);
  const metadataRoot = asRecord(metadata);
  const result: SupportedChain[] = [];
  for (const [id, raw] of Object.entries(metadataRoot)) {
    if (!/^\d{1,10}$/.test(id)) continue;
    const chain = asRecord(raw);
    const configEntry = asRecord(chainConfig[id]);
    const testnetValue = chain.isTestnet ?? chain.is_testnet ?? configEntry.isTestnet ?? configEntry.is_testnet;
    const isTestnet = testnetValue === true || testnetValue === "true";
    if (isTestnet) continue;
    const currency = asRecord(chain.nativeCurrency ?? chain.native_currency ?? configEntry.nativeCurrency);
    result.push({
      id,
      name: firstString(chain, ["name", "title", "chainName"]) ?? "EVM network " + id,
      isTestnet,
      explorerUrl: safeHttpsUrl(firstString(chain, ["url", "explorerUrl", "explorer_url", "explorer"])),
      nativeCurrencySymbol: firstString(currency, ["symbol"]) ?? firstString(chain, ["nativeCurrencySymbol", "native_currency_symbol"]),
    });
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getSupportedChains(): Promise<SupportedChain[]> {
  const configResponse = await fetch(PRO_API_BASE + "/api/json/config", {
    headers: { accept: "application/json" }, next: { revalidate: 300 }, signal: AbortSignal.timeout(10000),
  });
  if (!configResponse.ok) throw new Error("Blockscout chain registry failed (" + configResponse.status + ").");
  const config = await configResponse.json() as unknown;
  const chainIds = Object.keys(asRecord(asRecord(config).chains)).filter((id) => /^\d{1,10}$/.test(id)).slice(0, 300);
  if (!chainIds.length) throw new Error("Blockscout returned no supported EVM chain IDs.");
  const metadata: Record<string, unknown> = {};
  for (let offset = 0; offset < chainIds.length; offset += 50) {
    const url = new URL(CHAINS_METADATA_BASE);
    url.searchParams.set("chain_ids", chainIds.slice(offset, offset + 50).join(","));
    const response = await fetch(url, { headers: { accept: "application/json" }, next: { revalidate: 300 }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("Blockscout chain metadata failed (" + response.status + ").");
    Object.assign(metadata, asRecord(await response.json()));
  }
  const chains = normalizeSupportedChains(config, metadata);
  if (!chains.length) throw new Error("No mainnet networks could be resolved from the Blockscout registry.");
  return chains;
}

function getApiKey(): string {
  const key = process.env.BLOCKSCOUT_PRO_API_KEY?.trim();
  if (!key) throw new Error("Blockscout is not configured. Add BLOCKSCOUT_PRO_API_KEY to the server environment.");
  return key;
}
async function requestJson<T>(chainId: string, path: string): Promise<T> {
  if (!/^\d{1,10}$/.test(chainId)) throw new Error("Invalid chain identifier.");
  const url = new URL("/" + chainId + "/api/v2/" + path.replace(/^\/+/, ""), PRO_API_BASE);
  const response = await fetch(url, {
    headers: { accept: "application/json", authorization: "Bearer " + getApiKey() },
    cache: "no-store", signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error("Blockscout API key was rejected or lacks access to this network.");
    if (response.status === 429) throw new Error("Blockscout API rate limit reached. Try again later.");
    throw new Error("Blockscout request failed (" + response.status + ").");
  }
  return await response.json() as T;
}
function normalizeToken(entry: unknown): TokenHolding {
  const row = asRecord(entry);
  const token = asRecord(row.token ?? row);
  const rawDecimals = Number(token.decimals ?? 0);
  const decimals = Number.isInteger(rawDecimals) ? Math.min(36, Math.max(0, rawDecimals)) : 0;
  return {
    address: String(token.address_hash ?? token.address ?? ""),
    name: String(token.name ?? "Unknown token"),
    symbol: String(token.symbol ?? "—"),
    decimals,
    balance: String(row.value ?? row.balance ?? "0"),
    valueUsd: row.value_usd == null ? null : String(row.value_usd),
  };
}
export async function getChainPortfolio(chain: SupportedChain, addressInput: string): Promise<ChainPortfolio> {
  const address = validateAddress(addressInput);
  try {
    const [account, tokenData] = await Promise.all([
      requestJson<Record<string, unknown>>(chain.id, "addresses/" + address),
      requestJson<unknown>(chain.id, "addresses/" + address + "/tokens"),
    ]);
    const tokenRoot = asRecord(tokenData);
    const tokenItems = Array.isArray(tokenData) ? tokenData : Array.isArray(tokenRoot.items) ? tokenRoot.items : [];
    const count = Number(account.transactions_count);
    return {
      chain,
      nativeBalance: account.coin_balance == null ? null : String(account.coin_balance),
      transactionCount: Number.isFinite(count) ? count : null,
      tokens: tokenItems.slice(0, 100).map(normalizeToken),
    };
  } catch (error) {
    return { chain, nativeBalance: null, transactionCount: null, tokens: [], error: error instanceof Error ? error.message : "Explorer unavailable." };
  }
}
export function parsePaginationCursor(value: unknown): Record<string, string> {
  if (value === undefined || value === null || value === "") return {};

  let record: Record<string, unknown>;
  if (typeof value === "string") {
    if (value.length > MAX_CURSOR_LENGTH) throw new Error("Invalid or oversized pagination cursor.");
    try {
      record = asRecord(JSON.parse(value));
    } catch {
      throw new Error("Pagination cursor must be valid JSON.");
    }
  } else {
    record = asRecord(value);
    let serialized: string;
    try {
      serialized = JSON.stringify(record);
    } catch {
      throw new Error("Invalid pagination cursor.");
    }
    if (serialized.length > MAX_CURSOR_LENGTH) throw new Error("Invalid or oversized pagination cursor.");
  }

  const result: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const [key, raw] of Object.entries(record)) {
    // Blockscout cursors are opaque: retain future scalar fields, but never
    // forward malformed names, nested structures, or prototype-sensitive keys.
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key)) continue;
    if (typeof raw !== "string" && typeof raw !== "number") continue;
    if (typeof raw === "number" && !Number.isFinite(raw)) continue;

    const text = String(raw);
    if (text.length > 256) throw new Error("Pagination cursor field is too large.");
    result[key] = text;
  }

  if (!Object.keys(result).length) throw new Error("Pagination cursor contains no supported fields.");
  return result;
}
export async function getAddressActivity(chainId: string, addressInput: string, cursorValue?: unknown): Promise<{ transactions: unknown[]; tokenTransfers: unknown[]; nextPageParams: { transactions: Record<string, unknown>; tokenTransfers: Record<string, unknown> } }> {
  const address = validateAddress(addressInput);
  const cursor = asRecord(cursorValue);
  const txParams = new URLSearchParams(parsePaginationCursor(cursor.transactions));
  const transferParams = new URLSearchParams(parsePaginationCursor(cursor.tokenTransfers));
  const txSuffix = txParams.size ? "?" + txParams.toString() : "";
  const transferSuffix = transferParams.size ? "?" + transferParams.toString() : "";
  const [transactions, transfers] = await Promise.all([
    requestJson<Record<string, unknown>>(chainId, "addresses/" + address + "/transactions" + txSuffix),
    requestJson<Record<string, unknown>>(chainId, "addresses/" + address + "/token-transfers" + transferSuffix),
  ]);
  const txRoot = asRecord(transactions);
  const transferRoot = asRecord(transfers);
  return {
    transactions: Array.isArray(txRoot.items) ? txRoot.items : [],
    tokenTransfers: Array.isArray(transferRoot.items) ? transferRoot.items : [],
    nextPageParams: { transactions: asRecord(txRoot.next_page_params), tokenTransfers: asRecord(transferRoot.next_page_params) },
  };
}
export function hasBlockscoutApiKey(): boolean { return Boolean(process.env.BLOCKSCOUT_PRO_API_KEY?.trim()); }
