export function normalizeCurrency(value: unknown): string;
export function stripeMinorToMajor(amount: string | number | bigint, currency: string): string;
export function stripeMajorToMinor(amount: string | number | bigint | { toString(): string }, currency: string): number;
