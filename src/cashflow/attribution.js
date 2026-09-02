import { prisma } from './prisma.js';

export async function trackAffiliateClick({ affiliateCode, visitorId, sessionId, ipHash, userAgent, referrer, landingPage }) {
  const link = await prisma.affiliateLink.findFirst({ where: { code: affiliateCode, active: true } });
  if (!link) return null;
  return prisma.affiliateClick.create({
    data: { affiliateId: link.affiliateId, affiliateLinkId: link.id, visitorId, sessionId, ipHash, userAgent, referrer, landingPage }
  });
}

export async function attributeCustomer({ customerId, affiliateId, affiliateLinkId, affiliateCodeId, type = 'REFERRAL_LINK', cookieDays = 30 }) {
  const expiresAt = new Date(Date.now() + cookieDays * 86400000);
  return prisma.$transaction(async (tx) => {
    await tx.attribution.updateMany({ where: { customerId, status: 'ACTIVE' }, data: { lastTouch: false } });
    return tx.attribution.create({
      data: { customerId, affiliateId, affiliateLinkId, affiliateCodeId, type, firstTouch: false, lastTouch: true, expiresAt }
    });
  });
}
