import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { fileTypeFromBuffer } from "file-type";
import { z } from "zod";
import { getImage,putImage,readSession,removeImage,templates,workspace } from "../../../lib/image-studio";
import { prisma } from "../../../lib/prisma";

export const runtime="nodejs",dynamic="force-dynamic",maxDuration=300;
const schema=z.object({prompt:z.string().trim().min(8).max(8000),model:z.enum(["gpt-image-2.5-sunburst","gpt-image-2.5-flare"]).default("gpt-image-2.5-sunburst"),quality:z.enum(["low","medium","high","xhigh","max"]).default("high"),size:z.enum(["auto","1024x1024","1536x1024","1024x1536"]).default("1024x1024"),templateKey:z.string().max(80).optional()});
const select={id:true,prompt:true,model:true,mimeType:true,sizeBytes:true,source:true,templateKey:true,createdAt:true} as const;
async function dailyAllowed(userId:string){const since=new Date(Date.now()-86400000);const n=await prisma.imageGenerationJob.count({where:{userId,createdAt:{gte:since}}});return n<Number(process.env.IMAGE_STUDIO_DAILY_LIMIT||20);}
function fail(message:string,status=400){return NextResponse.json({error:message},{status,headers:{"Cache-Control":"no-store"}});}
export async function GET(req:Request){
 const session=readSession(req);if(!session)return fail("Unauthorized.",401);
 const url=new URL(req.url),view=url.searchParams.get("view")||"assets";
 try{
  if(view==="templates")return NextResponse.json({templates:templates()},{headers:{"Cache-Control":"private, max-age=300"}});
  const {user,organization}=await workspace(session.email);
  if(view==="file"){
   const id=url.searchParams.get("id");if(!id)return fail("Image id required.");
   const asset=await prisma.imageAsset.findFirst({where:{id,userId:user.id,organizationId:organization.id}});
   if(!asset)return fail("Image not found.",404);
   const image=await getImage(asset.storageKey);
   return new Response(new Uint8Array(image.bytes),{headers:{"Content-Type":image.type,"Content-Length":String(image.bytes.length),"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Disposition":'inline; filename="corleon-image"'}});
  }
  const cursor=url.searchParams.get("cursor"),q=url.searchParams.get("q")?.trim().slice(0,120),limit=Math.min(Math.max(Number(url.searchParams.get("limit")||40),1),60);
  const assets=await prisma.imageAsset.findMany({where:{userId:user.id,organizationId:organization.id,...(q?{prompt:{contains:q,mode:"insensitive"}}:{})},orderBy:{createdAt:"desc"},take:limit,...(cursor?{skip:1,cursor:{id:cursor}}:{}),select});
  return NextResponse.json({assets,nextCursor:assets.length===limit?assets[assets.length-1]?.id:null},{headers:{"Cache-Control":"private, no-store"}});
 }catch(e){return fail(e instanceof Error&&e.message.includes("storage")?e.message:"Studio database or storage is unavailable.",503);}
}
export async function POST(req:Request){
 const session=readSession(req);if(!session)return fail("Unauthorized.",401);
 if(!process.env.OPENAI_API_KEY)return fail("OPENAI_API_KEY is not configured.",503);
 const {user,organization}=await workspace(session.email);
 if(!await dailyAllowed(user.id))return fail("Daily image generation limit reached.",429);
 const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,timeout:270000,maxRetries:1});
 let jobId:string|undefined;
 try{
  if(req.headers.get("content-type")?.includes("multipart/form-data")){
   const form=await req.formData(),prompt=z.string().trim().min(8).max(8000).safeParse(form.get("prompt")),file=form.get("image");
   if(!prompt.success||!(file instanceof File))return fail("An image and editing prompt are required.");
   if(file.size<1||file.size>15*1024*1024)return fail("Upload must be smaller than 15 MB.",413);
   const bytes=Buffer.from(await file.arrayBuffer()),detected=await fileTypeFromBuffer(bytes);
   if(!detected||!["image/png","image/jpeg","image/webp"].includes(detected.mime))return fail("Only valid PNG, JPEG and WebP images are supported.",415);
   const originalId=randomUUID(),sourceKey=organization.id+"/"+user.id+"/"+originalId+"-source."+detected.ext;
   await putImage(sourceKey,bytes,detected.mime);
   const original=await prisma.imageAsset.create({data:{id:originalId,organizationId:organization.id,userId:user.id,storageKey:sourceKey,mimeType:detected.mime,sizeBytes:bytes.length,source:"UPLOAD"}});
   const job=await prisma.imageGenerationJob.create({data:{organizationId:organization.id,userId:user.id,operation:"EDIT",status:"RUNNING",prompt:prompt.data,model:"gpt-image-2.5-sunburst",quality:"high",size:"auto",inputAssetId:original.id}});
   jobId=job.id;
   const result=await client.images.edit({model:"gpt-image-2.5-sunburst",image:await toFile(bytes,"source."+detected.ext,{type:detected.mime}),prompt:prompt.data,quality:"high",output_format:"png"});
   const encoded=result.data?.[0]?.b64_json;if(!encoded)throw new Error("EMPTY_IMAGE_RESULT");
   const output=Buffer.from(encoded,"base64");if(!output.length||output.length>25*1024*1024)throw new Error("INVALID_IMAGE_RESULT");
   const id=randomUUID(),key=organization.id+"/"+user.id+"/"+id+".png";await putImage(key,output,"image/png");
   const asset=await prisma.imageAsset.create({data:{id,organizationId:organization.id,userId:user.id,storageKey:key,mimeType:"image/png",sizeBytes:output.length,prompt:prompt.data,model:"gpt-image-2.5-sunburst",source:"EDITED"},select});
   await prisma.imageGenerationJob.update({where:{id:job.id},data:{status:"COMPLETED",outputAssetId:id,completedAt:new Date()}});
   return NextResponse.json({jobId:job.id,asset},{status:201});
  }
  const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return fail(parsed.error.issues[0]?.message||"Invalid request.");
  const idempotencyKey=req.headers.get("idempotency-key")?.slice(0,128)||randomUUID();
  const existing=await prisma.imageGenerationJob.findUnique({where:{idempotencyKey},include:{outputAsset:true}});
  if(existing?.outputAsset)return NextResponse.json({jobId:existing.id,asset:existing.outputAsset,reused:true});
  if(existing)return fail("This request is already processing.",409);
  const input=parsed.data,job=await prisma.imageGenerationJob.create({data:{organizationId:organization.id,userId:user.id,operation:"GENERATE",status:"RUNNING",prompt:input.prompt,model:input.model,quality:input.quality,size:input.size,templateKey:input.templateKey,idempotencyKey}});
  jobId=job.id;
  const result=await client.images.generate({model:input.model,prompt:input.prompt,quality:input.quality,size:input.size,n:1,output_format:"png"});
  const encoded=result.data?.[0]?.b64_json;if(!encoded)throw new Error("EMPTY_IMAGE_RESULT");
  const bytes=Buffer.from(encoded,"base64");if(!bytes.length||bytes.length>25*1024*1024)throw new Error("INVALID_IMAGE_RESULT");
  const id=randomUUID(),key=organization.id+"/"+user.id+"/"+id+".png";await putImage(key,bytes,"image/png");
  const asset=await prisma.imageAsset.create({data:{id,organizationId:organization.id,userId:user.id,storageKey:key,mimeType:"image/png",sizeBytes:bytes.length,prompt:input.prompt,model:input.model,source:"GENERATED",templateKey:input.templateKey},select});
  await prisma.imageGenerationJob.update({where:{id:job.id},data:{status:"COMPLETED",outputAssetId:id,completedAt:new Date()}});
  return NextResponse.json({jobId:job.id,asset},{status:201});
 }catch(e){
  if(jobId)await prisma.imageGenerationJob.update({where:{id:jobId},data:{status:"FAILED",errorCode:"IMAGE_TASK_FAILED",completedAt:new Date()}}).catch(()=>undefined);
  const message=e instanceof Error?e.message:"Image operation failed.";
  return fail(message.includes("not configured")?message:"Image provider or storage operation failed. Check server configuration.",502);
 }
}
export async function DELETE(req:Request){
 const session=readSession(req);if(!session)return fail("Unauthorized.",401);
 const id=new URL(req.url).searchParams.get("id");if(!id)return fail("Image id required.");
 try{const {user,organization}=await workspace(session.email);const asset=await prisma.imageAsset.findFirst({where:{id,userId:user.id,organizationId:organization.id}});if(!asset)return fail("Image not found.",404);await removeImage(asset.storageKey);await prisma.imageAsset.delete({where:{id}});return NextResponse.json({deleted:true});}
 catch{return fail("Unable to delete image.",503);}
}
