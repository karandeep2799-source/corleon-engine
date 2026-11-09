import type {AgentRuntimeProvider} from "./types";
import {digitalOceanProvider} from "./digitalocean";
export function getAgentRuntimeProvider():AgentRuntimeProvider{const p=process.env.CORLEON_AGENT_RUNTIME_PROVIDER??"digitalocean";if(p==="digitalocean")return digitalOceanProvider;if(p==="vercel-sandbox")throw new Error("Vercel Sandbox adapter is not implemented yet; use DigitalOcean until its adapter is completed.");throw new Error(`Unsupported agent runtime provider: ${p}`);}
