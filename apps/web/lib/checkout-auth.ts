import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export interface CheckoutPrincipal {
  userId: string;
  organizationId: string;
  customerId: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Resolve a verified application session to exactly one customer-owned order.
 * CustomerUser links are provisioned by an organization operator; email alone
 * is never treated as authorization to pay an order.
 */
export async function getAuthenticatedCheckoutPrincipal(
  request: NextRequest,
  orderReference: string,
  organizationId?: string,
): Promise<CheckoutPrincipal | null> {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return null;

  const rawToken = request.cookies.get("__Host-corleon_session")?.value;
  if (!rawToken || rawToken.length > 128) return null;

  const session = await prisma.session.findFirst({
    where: { tokenHash: sha256(rawToken), expiresAt: { gt: new Date() } },
    select: { userId: true },
  });
  if (!session) return null;

  const orders = await prisma.order.findMany({
    where: {
      externalId: orderReference,
      ...(organizationId ? { organizationId } : {}),
      customer: { userLinks: { some: { userId: session.userId } } },
    },
    select: { organizationId: true, customerId: true },
    take: 2,
  });
  if (orders.length !== 1) return null;

  return {
    userId: session.userId,
    organizationId: orders[0].organizationId,
    customerId: orders[0].customerId,
  };
}
