import {NextRequest} from "next/server";
import {z} from "zod";
import {prisma} from "@/lib/creative/db";
import {requireCreativeTenant,authErrorResponse} from "@/lib/creative/auth";
export const runtime="nodejs";
const schema=z.object({name:z.string().trim().min(2).max(100),slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),description:z.string().max(2000).optional()});
export async function GET(req:NextRequest){try{const {tenantId}=await requireCreativeTenant(req);return Response.json({data:await prisma.creativeProject.findMany({where:{tenantId,status:"ACTIVE"},orderBy:{updatedAt:"desc"}})});}catch(e){return authErrorResponse(e)??Response.json({error:"internal_error"},{status:500});}}
export async function POST(req:NextRequest){try{const {tenantId,apiKeyId}=await requireCreativeTenant(req);const input=schema.parse(await req.json());const p=await prisma.creativeProject.create({data:{...input,tenantId}});await prisma.auditEvent.create({data:{tenantId,actorKeyId:apiKeyId,action:"creative.project.created",entityType:"CreativeProject",entityId:p.id}});return Response.json({data:p},{status:201});}catch(e){return authErrorResponse(e)??Response.json({error:"invalid_request",message:e instanceof Error?e.message:"Invalid request"},{status:400});}}