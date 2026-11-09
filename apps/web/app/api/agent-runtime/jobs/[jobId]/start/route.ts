import {NextRequest} from "next/server";
import {isAgentRuntimeAuthorized,unauthorizedResponse,runtimeDisabledResponse} from "@/src/lib/agent-runtime/auth";
import {getAgentRuntimeProvider} from "@/src/lib/agent-runtime/providers";
import {prisma} from "@/src/lib/agent-runtime/db";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function POST(request:NextRequest,context:{params:Promise<{jobId:string}>}){
 if(!isAgentRuntimeAuthorized(request))return unauthorizedResponse();
 if(process.env.CORLEON_AGENT_RUNTIME_ENABLED!=="true")return runtimeDisabledResponse();
 const {jobId}=await context.params;
 const job=await prisma.agentRuntimeJob.findUnique({where:{id:jobId},include:{session:true}});
 if(!job)return Response.json({error:"job_not_found"},{status:404});
 if(!job.session?.externalSessionId)return Response.json({error:"session_not_provisioned"},{status:409});
 if(job.startedAt||job.status==="RUNNING")return Response.json({error:"job_already_started"},{status:409});
 try{
  const provider=getAgentRuntimeProvider(),remote=await provider.getSession(job.session.externalSessionId),state=remote.session?.status??"UNKNOWN";
  if(state!=="SESSION_STATUS_READY"&&state!=="SESSION_STATUS_RUNNING")return Response.json({error:"session_not_ready",remoteStatus:state},{status:409});
  const claimed=await prisma.agentRuntimeJob.updateMany({where:{id:job.id,startedAt:null,status:"PROVISIONING"},data:{status:"RUNNING",startedAt:new Date()}});
  if(claimed.count!==1)return Response.json({error:"job_start_conflict"},{status:409});
  const message=[job.prompt,job.repository?`Repository: ${job.repository}`:"",job.branch?`Requested branch: ${job.branch}`:"","Work only within the provided workspace. Clone the declared repository if it is not already present. Do not deploy, publish, spend money, or change production systems. Report changed files and tests run."].filter(Boolean).join("\n\n");
  try{
   const run=await provider.sendInput(job.session.externalSessionId,message);
   await prisma.$transaction([
    prisma.agentRuntimeSession.update({where:{id:job.session.id},data:{status:"RUNNING",lastEventAt:new Date()}}),
    prisma.agentRuntimeAuditEvent.create({data:{organizationId:job.organizationId,jobId:job.id,sessionId:job.session.id,actorType:"service",action:"job.started",details:{provider:provider.id,runId:run.run_id??null}}})
   ]);
   return Response.json({started:true,runId:run.run_id??null});
  }catch(error){
   const message=error instanceof Error?error.message.slice(0,1000):"Unknown input error";
   await prisma.agentRuntimeJob.update({where:{id:job.id},data:{status:"FAILED",errorCode:"INPUT_FAILED",errorMessage:message}});
   throw error;
  }
 }catch(error){return Response.json({error:"job_start_failed",message:error instanceof Error?error.message:"Unknown error"},{status:502});}
}
