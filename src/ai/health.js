import { openai, models } from "./client.js";

const response = await openai.responses.create({
  model: models.fast,
  input: "Return the single word OK.",
  max_output_tokens: 8,
});

console.log(JSON.stringify({ ok: true, model: models.fast, output: response.output_text }));
