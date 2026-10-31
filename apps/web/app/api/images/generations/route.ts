import {ImageJobType} from '@prisma/client';
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authorizeImageRequest,jsonError} from '@/lib/images/auth';
import {IMAGE_OWNER_ID} from '@/lib/images/config';
import {prisma} from '@/lib/images/db';
import {builtinTemplates,applyTemplate} from '@/lib/images/templates';
import {runImageJob} from '@/lib/images/service';
import {signedImageUrl} from '@/lib/images/storage';
export const runtime='nodejs'; export const maxDuration=60;
const schema=z.object({prompt:z.string().min(3).max(32000),templateId:z.string().optional(),variables:z.record(z.string(),z.string().max(500)).optional(),size:z.enum(['1024x1024','1024x1536','1536x1024']).default('1024x1024'),quality:z.enum(['low','medium','high','auto']).default('high')}).strict();
export async function POST(req:Request){const denied=authorizeImageRequest(req);if(denied)return denied;const p=schema.safeParse(await req.json().catch(()=>null));if(!p.success)return jsonError('INVALID_REQUEST','Invalid image generation payload.',400);
let prompt=p.data.prompt;if(p.data.templateId){const custom=await prisma.imageTemplate.findFirst({where:{id:p.data.templateId,ownerId:IMAGE_OWNER_ID}});const builtin=builtinTemplates.find(t=>t.slug===p.data.templateId);const t=custom??builtin;if(!t)return jsonError('TEMPLATE_NOT_FOUND','Template not found.',404);prompt=applyTemplate(t.prompt,p.data.variables??{})+'\n\nUser direction: '+prompt;}
try{const r=await runImageJob({type:ImageJobType.GENERATION,prompt,idempotencyKey:req.headers.get('idempotency-key')??undefined,templateId:p.data.templateId,size:p.data.size,quality:p.data.quality});if(!r.asset)return NextResponse.json({job:r.job},{status:202});return NextResponse.json({job:{id:r.job.id,status:r.job.status},asset:{id:r.asset.id,mimeType:r.asset.mimeType,sizeBytes:r.asset.sizeBytes,url:await signedImageUrl(r.asset.objectKey)},replayed:r.replayed},{status:r.replayed?200:201});}catch(e){return jsonError('IMAGE_GENERATION_FAILED',e instanceof Error?e.message:'Generation failed.',502);}}
