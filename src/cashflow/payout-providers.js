import Stripe from 'stripe';
import { stripeMajorToMinor } from './money.js';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(name + ' is required');
  return value;
}

export class StripePayoutProvider {
  constructor() {
    this.stripe = new Stripe(requireEnv('STRIPE_SECRET_KEY'));
  }

  async send({ amount, currency, destination, metadata = {} }) {
    if (!destination) throw new Error('Stripe connected account destination is required');
    const normalizedCurrency = String(currency).trim().toUpperCase();
    const transfer = await this.stripe.transfers.create({
      amount: stripeMajorToMinor(amount, normalizedCurrency),
      currency: normalizedCurrency.toLowerCase(),
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
      externalId: 'manual:' + metadata.payoutId,
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
    default: throw new Error('Unsupported payout method: ' + method);
  }
}
