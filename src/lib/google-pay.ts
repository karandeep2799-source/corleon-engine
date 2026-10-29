export interface GooglePayPaymentProcessor {
  charge(input: { token: string; amountMinor: number; currency: string; idempotencyKey: string; orderReference: string }): Promise<{ providerReference: string; status: "SUCCEEDED" | "PROCESSING" }>;
}
export function extractGooglePayToken(payload: unknown): string {
  if (!payload || typeof payload !== "object") throw new Error("Invalid Google Pay payload");
  const data = (payload as { paymentMethodData?: { type?: string; tokenizationData?: { type?: string; token?: string } } }).paymentMethodData;
  const token = data?.tokenizationData?.token;
  if (data?.type !== "CARD" || data?.tokenizationData?.type !== "PAYMENT_GATEWAY" || typeof token !== "string" || token.length < 1 || token.length > 20000) throw new Error("Invalid Google Pay payment token");
  return token;
}
export function getConfiguredProcessor(): GooglePayPaymentProcessor {
  throw new Error("No processor-specific Google Pay adapter configured. Checkout must remain disabled until a supported PSP adapter is implemented and reviewed.");
}
