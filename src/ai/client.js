import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("OPENAI_API_KEY is required for the AI runtime");
}

export const openai = new OpenAI({ apiKey });

export const models = {
  reasoning: process.env.OPENAI_REASONING_MODEL || "gpt-5.6-sol",
  balanced: process.env.OPENAI_BALANCED_MODEL || "gpt-5.6-terra",
  fast: process.env.OPENAI_FAST_MODEL || "gpt-5.6-luna",
};
