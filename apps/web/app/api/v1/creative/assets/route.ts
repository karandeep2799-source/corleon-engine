import {NextRequest} from "next/server";
import {prisma} from "@/lib/creative/db";
import {requireCreativeTenant,authErrorResponse} from "@/lib/creative/auth";
import {downloadUrl} from "@/lib/creative/storage";
export const runtime="nodejs";
export async function GET(req:NextRequest){try{const {tenantId}=await requireCreativeTenant(req);const projectId=req.nextUrl.searchParams.get("projectId")??undefined;const rows=await prisma.generatedAsset.findMany({where:{tenantId,status:"READY",deletedAt:null,...(projectId?{projectId}:{})},orderBy:{createdAt:"desc"},take:100});const data=await Promise.all(rows.map(async({storageKey,...asset})=>({...asset,downloadUrl:await downloadUrl(storageKey)})));return Response.json({data});}catch(e){return authErrorResponse(e)??Response.json({error:"internal_error"},{status:500});}}