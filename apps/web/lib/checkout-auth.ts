import type { NextRequest } from "next/server";

export interface CheckoutPrincipal {
  userId: string;
  organizationId: string;
  customerId: string;
}

/**
 * Fail-closed authentication seam.
 *
 * The existing Corleon workspace does not yet expose a verified server-side
 * session provider or a durable user-to-customer mapping. Do not replace this
 * with identity headers, query parameters, or client-provided IDs. Wire the
 * real session adapter here before enabling checkout.
 */
export async function getAuthenticatedCheckoutPrincipal(_request: NextRequest): Promise<CheckoutPrincipal | null> {
  return null;
}
