import {ImageJobStatus,ImageJobType} from '@prisma/client';
import {NextResponse} from 'next/server';
import {authorizeImageRequest,jsonError} from '@/lib/images/auth';
import {IMAGE_OWNER_ID} from '@/lib/images/config';
import {prisma} from '@/lib/images/db';
import {storeImage,signedImageUrl} from '@/lib/images/storage';
export const runtime='nodejs';
export const maxDuration=30;
const MAX_BYTES=4*1024*1024;
function detectMime(bytes:Buffer){if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'image/jpeg';if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'image/webp';return null;}
export async function POST(req:Request){const d=authorizeImageRequest(req);if(d)return d;const form=await req.formData().catch(()=>null);const file=form?.get('file');if(!(file instanceof File))return jsonError('FILE_REQUIRED','Upload a file using the file field.',400);if(file.size<1||file.size>MAX_BYTES)return jsonError('FILE_TOO_LARGE','Image uploads must be 1 byte to 4 MiB.',413);const bytes=Buffer.from(await file.arrayBuffer());const mimeType=detectMime(bytes);if(!mimeType)return jsonError('UNSUPPORTED_IMAGE','Only valid PNG, JPEG and WebP images are accepted.',415);
const job=await prisma.imageJob.create({data:{ownerId:IMAGE_OWNER_ID,type:ImageJobType.EDIT,status:ImageJobStatus.COMPLETED,prompt:'User uploaded source image',model:'user-upload',completedAt:new Date()}});
try{const stored=await storeImage(bytes,mimeType);const asset=await prisma.imageAsset.create({data:{ownerId:IMAGE_OWNER_ID,jobId:job.id,objectKey:stored.objectKey,mimeType,sizeBytes:stored.sizeBytes,prompt:'User uploaded source image',model:'user-upload'}});return NextResponse.json({data:{id:asset.id,mimeType:asset.mimeType,sizeBytes:asset.sizeBytes,url:await signedImageUrl(asset.objectKey)}},{status:201});}catch(e){await prisma.imageJob.delete({where:{id:job.id}});return jsonError('UPLOAD_FAILED',e instanceof Error?e.message:'Image upload failed.',500);}}
