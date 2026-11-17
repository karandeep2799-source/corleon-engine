export interface StripeWebhookResult {
  eventId: string;
  result?: unknown;
  duplicate?: boolean;
  ignored?: boolean;
}

export function handleStripeWebhook(
  rawBody: Uint8Array,
  signature: string,
): Promise<StripeWebhookResult>;
