import {NextRequest} from "next/server";
import {prisma} from "@/lib/creative/db";
import {requireCreativeTenant,authErrorResponse} from "@/lib/creative/auth";
export const runtime="nodejs";
export async function GET(req:NextRequest,ctx:{params:Promise<{id:string}>}){try{const {tenantId}=await requireCreativeTenant(req);const {id}=await ctx.params;const data=await prisma.generationJob.findFirst({where:{id,tenantId},include:{assets:{select:{id:true,mimeType:true,format:true,byteSize:true,sha256:true,createdAt:true}},usage:true}});if(!data)return Response.json({error:"generation_not_found"},{status:404});return Response.json({data});}catch(e){return authErrorResponse(e)??Response.json({error:"internal_error"},{status:500});}}