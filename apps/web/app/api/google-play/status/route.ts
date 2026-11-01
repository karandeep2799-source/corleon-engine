import { NextRequest, NextResponse } from 'next/server';
import { getGooglePlayConfig } from '../../../../../../src/google-play/config';
import { isGooglePlayAdminRequest } from '../../../../../../src/google-play/security';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  if (!isGooglePlayAdminRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const config = getGooglePlayConfig();
  return NextResponse.json({
    configured: Boolean(config.packageName && config.serviceAccount && !config.credentialError),
    packageNameConfigured: config.packageNameConfigured, packageNameError: config.packageNameError,
    serviceAccountConfigured: Boolean(config.serviceAccount), credentialError: config.credentialError,
    adminTokenConfigured: config.adminTokenConfigured, developerAccountIdConfigured: config.developerAccountIdConfigured,
    pubSubConfigured: config.pubSubConfigured, publishingEnabled: config.publishingEnabled,
    supportWritesEnabled: config.supportWritesEnabled, writeApprovalConfigured: config.writeApprovalConfigured,
    productionPublishingEnabled: config.productionPublishingEnabled,
    productionApprovalConfigured: config.productionApprovalConfigured,
    capabilities: { purchaseVerification: true, subscriptionLookup: true, voidedPurchases: true, reviewsRead: true,
      reviewReplies: config.supportWritesEnabled && config.writeApprovalConfigured, vitalsReporting: true,
      publishing: config.publishingEnabled && config.writeApprovalConfigured,
      productionRelease: config.productionPublishingEnabled && config.productionApprovalConfigured },
  }, { headers: { 'cache-control': 'no-store' } });
}