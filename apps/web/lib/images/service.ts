import {ImageJobType,ImageJobStatus} from '@prisma/client';
import {prisma} from './db';
import {IMAGE_OWNER_ID} from './config';
import {generateImage,editImage} from './provider';
import {readImage,storeImage} from './storage';
export async function runImageJob(i:{type:ImageJobType;prompt:string;idempotencyKey?:string;sourceAssetId?:string;templateId?:string;size?:'1024x1024'|'1024x1536'|'1536x1024';quality?:'low'|'medium'|'high'|'auto'}){
 if(i.idempotencyKey){const old=await prisma.imageJob.findFirst({where:{ownerId:IMAGE_OWNER_ID,idempotencyKey:i.idempotencyKey},include:{asset:true}});if(old){if(old.status===ImageJobStatus.PROCESSING)throw new Error('An image job with this idempotency key is already processing.');return {job:old,asset:old.asset,replayed:true};}}
 const job=await prisma.imageJob.create({data:{ownerId:IMAGE_OWNER_ID,type:i.type,status:ImageJobStatus.PROCESSING,prompt:i.prompt,model:process.env.IMAGES_MODEL??'gpt-image-2.5-sunburst',idempotencyKey:i.idempotencyKey,sourceAssetId:i.sourceAssetId,templateId:i.templateId}});
 try{
  const result=i.type===ImageJobType.GENERATION?await generateImage({prompt:i.prompt,size:i.size,quality:i.quality}):await (async()=>{if(!i.sourceAssetId)throw new Error('Source asset is required.');const source=await prisma.imageAsset.findFirst({where:{id:i.sourceAssetId,ownerId:IMAGE_OWNER_ID}});if(!source)throw new Error('Source image was not found.');return editImage({prompt:i.prompt,sourceBytes:await readImage(source.objectKey),mimeType:source.mimeType});})();
  const stored=await storeImage(result.bytes,result.mimeType);
  const asset=await prisma.imageAsset.create({data:{ownerId:IMAGE_OWNER_ID,jobId:job.id,objectKey:stored.objectKey,mimeType:result.mimeType,sizeBytes:stored.sizeBytes,prompt:i.prompt,model:job.model}});
  const completed=await prisma.imageJob.update({where:{id:job.id},data:{status:ImageJobStatus.COMPLETED,completedAt:new Date(),metadata:result.revisedPrompt?{revisedPrompt:result.revisedPrompt}:undefined},include:{asset:true}});
  return {job:completed,asset,replayed:false};
 }catch(e){await prisma.imageJob.update({where:{id:job.id},data:{status:ImageJobStatus.FAILED,errorCode:'IMAGE_PROCESSING_FAILED',errorMessage:(e instanceof Error?e.message:'Image processing failed.').slice(0,1000)}});throw e;}
}