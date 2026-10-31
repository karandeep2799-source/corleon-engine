export const PAYMENT_CURRENCY = 'INR' as const;
export const MIN_AMOUNT_PAISE = 100;
export const MAX_AMOUNT_PAISE = 500_000_00;

export type PaymentActor = { userId: string };
export type PaymentStatus = 'PROCESSING' | 'CREATED' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REFUNDED';

export function validateAmount(amount: unknown): number {
  if (!Number.isSafeInteger(amount) || (amount as number) < MIN_AMOUNT_PAISE || (amount as number) > MAX_AMOUNT_PAISE) {
    throw new Error('Amount must be an integer number of paise between ₹1 and ₹5,00,000.');
  }
  return amount as number;
}

export function safeIdempotencyKey(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._:-]{12,100}$/.test(value)) {
    throw new Error('A valid idempotencyKey (12–100 safe characters) is required.');
  }
  return value;
}
