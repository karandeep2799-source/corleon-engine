import type { NextRequest } from "next/server";

export interface CheckoutPrincipal {
  userId: string;
  organizationId: string;
  customerId: string;
}

/**
 * Security integration seam. This repository does not currently contain an
 * authenticated session provider or a user-to-customer mapping. Never trust
 * client-supplied identity headers. Replace this implementation with the
 * application's verified server-side session adapter before enabling checkout.
 */
export async function getAuthenticatedCheckoutPrincipal(_request: NextRequest): Promise<CheckoutPrincipal | null> {
  return null;
}
