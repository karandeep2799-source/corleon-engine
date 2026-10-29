import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const environment = process.env.GOOGLE_PAY_ENVIRONMENT ?? "TEST";
  const merchantId = process.env.GOOGLE_PAY_MERCHANT_ID?.trim();
  const gateway = process.env.GOOGLE_PAY_GATEWAY?.trim();
  const gatewayMerchantId = process.env.GOOGLE_PAY_GATEWAY_MERCHANT_ID?.trim();
  const countryCode = process.env.GOOGLE_PAY_COUNTRY_CODE ?? "IN";
  const currencyCode = process.env.GOOGLE_PAY_CURRENCY_CODE ?? "INR";
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (!["TEST", "PRODUCTION"].includes(environment)) return NextResponse.json({ error: "Invalid Google Pay environment" }, { status: 500, headers });
  if (environment === "PRODUCTION" && (!merchantId || !gateway || !gatewayMerchantId)) return NextResponse.json({ error: "Production merchant and payment gateway configuration is required" }, { status: 503, headers });
  if (!/^[A-Z]{2}$/.test(countryCode) || !/^[A-Z]{3}$/.test(currencyCode)) return NextResponse.json({ error: "Invalid country/currency configuration" }, { status: 500, headers });
  return NextResponse.json({
    environment, apiVersion: 2, apiVersionMinor: 0,
    merchantInfo: environment === "PRODUCTION" ? { merchantId, merchantName: process.env.GOOGLE_PAY_MERCHANT_NAME ?? "Corleon Engine" } : { merchantName: process.env.GOOGLE_PAY_MERCHANT_NAME ?? "Corleon Engine (Test)" },
    allowedPaymentMethods: [{ type: "CARD", parameters: { allowedAuthMethods: ["PAN_ONLY", "CRYPTOGRAM_3DS"], allowedCardNetworks: ["AMEX", "DISCOVER", "MASTERCARD", "VISA"], billingAddressRequired: false }, tokenizationSpecification: { type: "PAYMENT_GATEWAY", parameters: gateway && gatewayMerchantId ? { gateway, gatewayMerchantId } : { gateway: "example", gatewayMerchantId: "exampleGatewayMerchantId" } } }],
    transactionInfoDefaults: { countryCode, currencyCode }
  }, { headers });
}