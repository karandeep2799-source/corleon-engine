import {NextRequest} from "next/server";
import Stripe from "stripe";
import {prisma} from "@/lib/creative/db";
import {requireCreativeTenant,authErrorResponse} from "@/lib/creative/auth";
export const runtime="nodejs";
export async function POST(req:NextRequest){try{const {tenantId}=await requireCreativeTenant(req);if(!process.env.STRIPE_SECRET_KEY)throw new Error("Stripe is not configured");const account=await prisma.creativeBillingAccount.findUnique({where:{tenantId}});if(!account)return Response.json({error:"billing_account_not_found"},{status:404});const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);const session=await stripe.billingPortal.sessions.create({customer:account.stripeCustomerId,return_url:process.env.CREATIVE_BILLING_SUCCESS_URL!});return Response.json({data:{portalUrl:session.url}});}catch(e){return authErrorResponse(e)??Response.json({error:"billing_portal_failed",message:e instanceof Error?e.message:"Portal failed"},{status:500});}}