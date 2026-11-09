import {NextRequest} from "next/server";
import {isAgentRuntimeAuthorized,unauthorizedResponse} from "@/src/lib/agent-runtime/auth";
import {prisma} from "@/src/lib/agent-runtime/db";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 if(!isAgentRuntimeAuthorized(request))return unauthorizedResponse();
 const [jobs,sessions,pendingApprovals]=await Promise.all([
  prisma.agentRuntimeJob.groupBy({by:["status"],_count:{_all:true}}),
  prisma.agentRuntimeSession.groupBy({by:["status"],_count:{_all:true}}),
  prisma.agentRuntimeApproval.count({where:{status:"PENDING"}})
 ]);
 return Response.json({enabled:process.env.CORLEON_AGENT_RUNTIME_ENABLED==="true",provider:process.env.CORLEON_AGENT_RUNTIME_PROVIDER??"digitalocean",jobs:Object.fromEntries(jobs.map(x=>[x.status,x._count._all])),sessions:Object.fromEntries(sessions.map(x=>[x.status,x._count._all])),pendingApprovals,timestamp:new Date().toISOString()},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(request:NextRequest){
 if(!isAgentRuntimeAuthorized(request))return unauthorizedResponse();
 const body=await request.json().catch(()=>null);
 if(!body||typeof body.organizationId!=="string"||typeof body.prompt!=="string")return Response.json({error:"organizationId and prompt are required"},{status:400});
 const organizationId=body.organizationId.trim(),prompt=body.prompt.trim();
 if(!organizationId||prompt.length<3||prompt.length>20000)return Response.json({error:"Invalid organizationId or prompt length"},{status:400});
 const adapter=body.adapter==="CLAUDE_CODE"?"CLAUDE_CODE":body.adapter==="OPENCODE"?"OPENCODE":"CODEX";
 const repository=typeof body.repository==="string"?body.repository.trim():null;
 if(repository&&!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository))return Response.json({error:"repository must use OWNER/REPO format"},{status:400});
 const rawKey=request.headers.get("idempotency-key");
 if(rawKey!==null&&!/^[A-Za-z0-9._:-]{8,128}$/.test(rawKey))return Response.json({error:"Invalid Idempotency-Key header"},{status:400});
 const idempotencyKey=rawKey;
 if(idempotencyKey){const existing=await prisma.agentRuntimeJob.findUnique({where:{idempotencyKey},include:{session:true}});if(existing)return Response.json({job:existing},{status:200});}
 try{
  const job=await prisma.agentRuntimeJob.create({data:{organizationId,requestedBy:typeof body.requestedBy==="string"?body.requestedBy:null,adapter,prompt,repository,branch:typeof body.branch==="string"?body.branch:null,idempotencyKey,metadata:{source:"corleon-api",approvalRequired:true},auditEvents:{create:{organizationId,actorType:"service",actorId:"corleon-api",action:"job.created",details:{adapter,repository}}}}});
  return Response.json({job},{status:201,headers:{"Cache-Control":"no-store"}});
 }catch(error){
  if(idempotencyKey){const existing=await prisma.agentRuntimeJob.findUnique({where:{idempotencyKey},include:{session:true}});if(existing)return Response.json({job:existing},{status:200});}
  console.error("agent_runtime_job_create_failed",{error});
  return Response.json({error:"job_create_failed"},{status:500});
 }
}
