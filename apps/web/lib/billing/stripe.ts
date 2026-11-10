import Stripe from 'stripe';

let stripeClient: Stripe | undefined;

export function getStripe(): Stripe {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error('STRIPE_SECRET_KEY is not configured.');
  if (!secret.startsWith('sk_test_') && process.env.STRIPE_LIVE_PAYMENTS_ENABLED !== 'true') {
    throw new Error('Live Stripe keys are blocked until STRIPE_LIVE_PAYMENTS_ENABLED=true.');
  }
  if (!stripeClient) stripeClient = new Stripe(secret);
  return stripeClient;
}

export function assertSandboxOnly(): void {
  if (process.env.STRIPE_LIVE_PAYMENTS_ENABLED === 'true') {
    throw new Error('This Corleon invoice workflow is intentionally sandbox-only.');
  }
}
