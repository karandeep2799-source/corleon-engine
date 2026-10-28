import OpenAI from "openai";
import { PrismaClient } from "@prisma/client";
import { ASSISTANT_REGISTRY, getAssistantDefinition } from "./registry.js";

const globalForPrisma = globalThis;
const prisma = globalForPrisma.__corleonPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.__corleonPrisma = prisma;
const DEFAULT_MODEL = process.env.OPENAI_BALANCED_MODEL || "gpt-5.6-terra";
const MAX_INPUT_CHARS = 50_000;

export function getAssistantCatalog() {
  return ASSISTANT_REGISTRY.map(({ instructions, ...publicDefinition }) => publicDefinition);
}

export async function syncAssistantProfiles(organizationId) {
  if (typeof organizationId !== "string" || !organizationId.trim() || organizationId.length > 128) {
    const error = new Error("A valid organizationId is required."); error.statusCode = 400; throw error;
  }
  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
  if (!organization) { const error = new Error("Organization not found."); error.statusCode = 404; throw error; }
  for (const definition of ASSISTANT_REGISTRY) {
    await prisma.assistantProfile.upsert({
      where: { organizationId_key: { organizationId, key: definition.id } },
      create: {
        organizationId, key: definition.id, name: definition.name, category: definition.category,
        description: definition.description, readiness: definition.readiness, outputMode: definition.outputMode,
        enabled: definition.readiness === "ready", model: DEFAULT_MODEL, systemPrompt: definition.instructions,
      },
      update: {
        name: definition.name, category: definition.category, description: definition.description,
        readiness: definition.readiness, outputMode: definition.outputMode, systemPrompt: definition.instructions,
      },
    });
  }
}

export async function listOrganizationAssistants(organizationId) {
  await syncAssistantProfiles(organizationId);
  return prisma.assistantProfile.findMany({
    where: { organizationId },
    select: { id: true, key: true, name: true, category: true, description: true, readiness: true, outputMode: true, enabled: true, model: true, updatedAt: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}

export async function configureAssistant({ organizationId, assistantId, enabled, model }) {
  if (typeof enabled !== "boolean" && model === undefined) throw new Error("Provide enabled (boolean) and/or model.");
  if (model !== undefined && (typeof model !== "string" || model.length > 200 || !/^[a-zA-Z0-9._:/-]+$/.test(model))) throw new Error("Invalid model identifier.");
  await syncAssistantProfiles(organizationId);
  if (!getAssistantDefinition(assistantId)) { const error = new Error("Unknown assistantId."); error.statusCode = 404; throw error; }
  const data = {};
  if (enabled !== undefined) data.enabled = enabled;
  if (model !== undefined) data.model = model;
  return prisma.assistantProfile.update({
    where: { organizationId_key: { organizationId, key: assistantId } }, data,
    select: { id: true, key: true, name: true, enabled: true, model: true, readiness: true, outputMode: true },
  });
}

export async function runAssistant({ organizationId, assistantId, input }) {
  if (typeof input !== "string" || !input.trim() || input.length > MAX_INPUT_CHARS) {
    const error = new Error(`input must be a non-empty string of at most ${MAX_INPUT_CHARS} characters.`); error.statusCode = 400; throw error;
  }
  await syncAssistantProfiles(organizationId);
  const definition = getAssistantDefinition(assistantId);
  if (!definition) { const error = new Error("Unknown assistantId."); error.statusCode = 404; throw error; }
  const profile = await prisma.assistantProfile.findUnique({ where: { organizationId_key: { organizationId, key: assistantId } } });
  if (!profile?.enabled) { const error = new Error("This assistant is disabled for the organization."); error.statusCode = 409; throw error; }
  if (definition.readiness !== "ready" || definition.outputMode !== "text") {
    const error = new Error("This assistant requires an integration that is not configured in this runtime.");
    error.statusCode = 501; error.details = { assistantId, readiness: definition.readiness, outputMode: definition.outputMode }; throw error;
  }
  if (!process.env.OPENAI_API_KEY) { const error = new Error("OPENAI_API_KEY is not configured."); error.statusCode = 503; throw error; }
  const model = profile.model || DEFAULT_MODEL;
  const run = await prisma.assistantRun.create({
    data: { organizationId, assistantProfileId: profile.id, assistantKey: assistantId, status: "RUNNING", provider: "openai", model, input: { text: input } },
    select: { id: true, createdAt: true },
  });
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model, instructions: profile.systemPrompt, input,
      max_output_tokens: Number(process.env.CORLEON_ASSISTANT_MAX_OUTPUT_TOKENS || 3000),
    });
    const output = response.output_text || "";
    await prisma.assistantRun.update({ where: { id: run.id }, data: { status: "SUCCEEDED", output, finishedAt: new Date(), providerResponseId: response.id } });
    return { runId: run.id, assistantId, model, output, createdAt: run.createdAt };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message.slice(0, 1000) : "Assistant execution failed.";
    await prisma.assistantRun.update({ where: { id: run.id }, data: { status: "FAILED", errorMessage: message, finishedAt: new Date() } }).catch((e) => console.error("Failed to persist assistant failure", e));
    const error = new Error("Assistant execution failed. Check the run record for details."); error.statusCode = 502; throw error;
  }
}
