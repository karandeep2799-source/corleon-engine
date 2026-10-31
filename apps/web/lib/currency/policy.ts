export const CURRENCY_NAME = "Corleon";
export const CURRENCY_CODE = "CRL";
export const SETTLEMENT_CURRENCY = "INR" as const;

export function parseCreditAmount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0 || value > 1_000_000) return null;
  return value;
}

export function normalizeCustomerEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function storeSlug(value: string): string {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

export function canRedeem(balance: number, amount: number): boolean {
  return Number.isSafeInteger(balance) && Number.isSafeInteger(amount) && amount > 0 && balance >= amount;
}
