import {GetObjectCommand,PutObjectCommand,S3Client} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {randomUUID} from 'node:crypto';
import {getImageConfig} from './config';
let client:S3Client|undefined;
function s3(){const c=getImageConfig();client??=new S3Client({region:c.IMAGES_STORAGE_REGION,endpoint:c.IMAGES_STORAGE_ENDPOINT,forcePathStyle:!!c.IMAGES_STORAGE_ENDPOINT,credentials:{accessKeyId:c.IMAGES_STORAGE_ACCESS_KEY_ID,secretAccessKey:c.IMAGES_STORAGE_SECRET_ACCESS_KEY}});return {client,bucket:c.IMAGES_STORAGE_BUCKET};}
export async function storeImage(bytes:Buffer,mimeType:string){const {client,bucket}=s3();const ext=mimeType==='image/webp'?'webp':mimeType==='image/jpeg'?'jpg':'png';const objectKey=`corleon/images/${new Date().toISOString().slice(0,10)}/${randomUUID()}.${ext}`;await client.send(new PutObjectCommand({Bucket:bucket,Key:objectKey,Body:bytes,ContentType:mimeType,CacheControl:'private, max-age=3600'}));return {objectKey,sizeBytes:bytes.byteLength};}
export async function readImage(objectKey:string){const {client,bucket}=s3();const r=await client.send(new GetObjectCommand({Bucket:bucket,Key:objectKey}));if(!r.Body)throw new Error('Stored image has no body.');return Buffer.from(await r.Body.transformToByteArray());}
export async function signedImageUrl(objectKey:string){const {client,bucket}=s3();return getSignedUrl(client,new GetObjectCommand({Bucket:bucket,Key:objectKey}),{expiresIn:900});}