import type { AgentRuntimeProvider } from "./types";
import { createSession, getSession, sendInput, cancelSession, pauseSession, resumeSession, removeSession, resolveHITL, openSessionEvents } from "../digitalocean";

export const digitalOceanProvider: AgentRuntimeProvider = {
  id: "digitalocean", createSession, getSession, sendInput, cancel: cancelSession,
  pause: pauseSession, resume: resumeSession, remove: removeSession, resolveHITL, openSessionEvents,
};
