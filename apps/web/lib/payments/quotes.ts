import { randomUUID } from 'node:crypto';
import { validateAmount } from './domain';
import { prisma } from './prisma';

/**
 * Call only from a trusted server-side checkout flow after loading products,
 * discounts, tax and shipping from authoritative records. Never call from a
 * browser route that accepts the price from the customer.
 */
export async function createPaymentQuote(input: {
  userId: string;
  amount: number;
  description: string;
  expiresInSeconds?: number;
}) {
  if (!input.userId || input.userId.length > 191) throw new Error('A valid user ID is required.');
  const amount = validateAmount(input.amount);
  const description = input.description.trim().slice(0, 120);
  if (!description) throw new Error('A checkout description is required.');
  const ttl = Math.min(Math.max(input.expiresInSeconds ?? 900, 60), 1800);
  return prisma.paymentQuote.create({
    data: {
      id: randomUUID(), userId: input.userId, amount, currency: 'INR',
      description, expiresAt: new Date(Date.now() + ttl * 1000),
    },
    select: { id: true, amount: true, currency: true, description: true, expiresAt: true },
  });
}
