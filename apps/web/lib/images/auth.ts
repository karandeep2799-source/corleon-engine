import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getImageConfig } from './config';
export function authorizeImageRequest(request:Request):NextResponse|null {
 let expected:string; try { expected=getImageConfig().IMAGES_API_TOKEN; } catch { return NextResponse.json({error:{code:'IMAGES_NOT_CONFIGURED',message:'Image API is not configured.'}},{status:503}); }
 const h=request.headers.get('authorization')??'', supplied=h.startsWith('Bearer ')?h.slice(7):'';
 const a=Buffer.from(supplied), b=Buffer.from(expected);
 if(a.length!==b.length||!timingSafeEqual(a,b)) return NextResponse.json({error:{code:'UNAUTHORIZED',message:'A valid Corleon Images API token is required.'}},{status:401});
 return null;
}
export function jsonError(code:string,message:string,status:number){return NextResponse.json({error:{code,message}},{status});}