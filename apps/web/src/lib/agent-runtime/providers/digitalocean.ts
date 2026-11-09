import type {AgentRuntimeProvider} from "./types";
import {createSession,sendInput,cancelSession,pauseSession,resumeSession,removeSession} from "../digitalocean";
export const digitalOceanProvider:AgentRuntimeProvider={id:"digitalocean",createSession,sendInput,cancel:cancelSession,pause:pauseSession,resume:resumeSession,remove:removeSession};
