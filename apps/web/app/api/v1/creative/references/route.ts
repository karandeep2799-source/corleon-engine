import {randomUUID} from "node:crypto";
import {NextRequest} from "next/server";
import {z} from "zod";
import {prisma} from "@/lib/creative/db";
import {requireCreativeTenant,authErrorResponse} from "@/lib/creative/auth";
import {uploadUrl} from "@/lib/creative/storage";
export const runtime="nodejs";
const schema=z.object({projectId:z.string(),fileName:z.string().min(1).max(180).regex(/^[\w. -]+$/),contentType:z.enum(["image/png","image/jpeg","image/webp"]),byteSize:z.number().int().positive().max(20*1024*1024)});
export async function POST(req:NextRequest){try{const {tenantId,apiKeyId}=await requireCreativeTenant(req);const v=schema.parse(await req.json());const p=await prisma.creativeProject.findFirst({where:{id:v.projectId,tenantId}});if(!p)return Response.json({error:"project_not_found"},{status:404});const id=randomUUID(),ext=v.contentType==="image/jpeg"?"jpg":v.contentType.split("/")[1],storageKey=`tenants/${tenantId}/references/${id}.${ext}`;const ref=await prisma.imageReference.create({data:{id,tenantId,projectId:v.projectId,storageKey,mimeType:v.contentType,byteSize:BigInt(v.byteSize)}});const url=await uploadUrl(storageKey,v.contentType);await prisma.auditEvent.create({data:{tenantId,actorKeyId:apiKeyId,action:"creative.reference.created",entityType:"ImageReference",entityId:id}});return Response.json({data:{id:ref.id,uploadUrl:url,expiresInSeconds:300,requiredHeaders:{"Content-Type":v.contentType}}},{status:201});}catch(e){return authErrorResponse(e)??Response.json({error:"invalid_request",message:e instanceof Error?e.message:"Invalid request"},{status:400});}}