import { NextRequest, NextResponse } from 'next/server';
import { getGooglePlayConfig } from '../../../../../../src/google-play/config.js';
import { isGooglePlayAdminRequest } from '../../../../../../src/google-play/security.js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  if (!isGooglePlayAdminRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const config = getGooglePlayConfig();
  return NextResponse.json({
    configured: Boolean(config.packageName && config.serviceAccount && !config.credentialError),
    packageNameConfigured: Boolean(config.packageName), serviceAccountConfigured: Boolean(config.serviceAccount),
    credentialError: config.credentialError, adminTokenConfigured: config.adminTokenConfigured,
    pubSubConfigured: config.pubSubConfigured, publishingEnabled: config.publishingEnabled,
    supportWritesEnabled: config.supportWritesEnabled, writeApprovalConfigured: config.writeApprovalConfigured,
    capabilities: { purchaseVerification: true, subscriptionLookup: true, voidedPurchases: true, reviewsRead: true,
      reviewReplies: config.supportWritesEnabled && config.writeApprovalConfigured, vitalsReporting: true,
      publishing: config.publishingEnabled && config.writeApprovalConfigured, productionRelease: false },
  }, { headers: { 'cache-control': 'no-store' } });
}