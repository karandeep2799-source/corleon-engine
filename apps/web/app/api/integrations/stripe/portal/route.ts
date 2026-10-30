import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';
import { requireTaskOS } from '@/lib/taskos/security';
import { db } from '@/lib/taskos/db';

const schema = z.object({ returnUrl: z.string().url() });

export async function POST(request: Request) {
  try {
    const { tenantId } = requireTaskOS(request), { returnUrl } = schema.parse(await request.json());
    if (new URL(returnUrl).origin !== new URL(process.env.APP_URL!).origin) return NextResponse.json({ error: 'Return URL must use the configured application origin' }, { status: 400 });
    const customer = await db.stripeCustomer.findUnique({ where: { tenantId } });
    if (!customer) return NextResponse.json({ error: 'Billing customer not found' }, { status: 404 });
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const portal = await stripe.billingPortal.sessions.create({ customer: customer.stripeCustomerId, return_url: returnUrl });
    return NextResponse.json({ url: portal.url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? error.flatten() : 'Billing portal unavailable' }, { status: error instanceof z.ZodError ? 400 : 401 });
  }
}
