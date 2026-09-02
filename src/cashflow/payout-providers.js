import Stripe from 'stripe';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export class StripePayoutProvider {
  constructor() {
    this.stripe = new Stripe(requireEnv('STRIPE_SECRET_KEY'));
  }

  async send({ amount, currency, destination, metadata = {} }) {
    // Stripe Connect transfers move funds from the platform to a connected account.
    if (!destination) throw new Error('Stripe connected account destination is required');
    const transfer = await this.stripe.transfers.create({
      amount: Math.round(Number(amount) * 100),
      currency: currency.toLowerCase(),
      destination,
      metadata
    }, {
      idempotencyKey: metadata.idempotencyKey
    });
    return { externalId: transfer.id, status: 'PAID', raw: transfer };
  }
}

export class ManualPayoutProvider {
  async send({ amount, currency, metadata = {} }) {
    return {
      externalId: `manual:${metadata.payoutId}`,
      status: 'PENDING_REVIEW',
      amount,
      currency
    };
  }
}

export function getPayoutProvider(method) {
  switch (method) {
    case 'STRIPE': return new StripePayoutProvider();
    case 'MANUAL': return new ManualPayoutProvider();
    case 'PAYPAL': throw new Error('PayPal provider not configured');
    case 'WISE': throw new Error('Wise provider not configured');
    case 'BANK_TRANSFER': throw new Error('Bank-transfer provider not configured');
    default: throw new Error(`Unsupported payout method: ${method}`);
  }
}
