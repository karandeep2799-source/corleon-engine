import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
export function isAgentRuntimeAuthorized(request: NextRequest): boolean {
 const expected=process.env.CORLEON_AGENT_RUNTIME_API_TOKEN;
 if(!expected||expected.length<32)return false;
 const h=request.headers.get("authorization")??"",supplied=h.startsWith("Bearer ")?h.slice(7):"";
 const a=Buffer.from(expected),b=Buffer.from(supplied);
 return b.length>0&&a.length===b.length&&timingSafeEqual(a,b);
}
export const unauthorizedResponse=()=>Response.json({error:"unauthorized"},{status:401});
export const runtimeDisabledResponse=()=>Response.json({error:"agent_runtime_disabled",message:"Provisioning is disabled until explicitly enabled."},{status:503});
