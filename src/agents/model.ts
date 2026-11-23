import "dotenv/config";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";

const ModelConfigSchema = z.object({
  OPENROUTER_API_KEY: z.string().trim().min(1),
  OPENROUTER_MODEL: z.string().trim().min(1),
});

export function createModel(env: NodeJS.ProcessEnv = process.env): ChatOpenAI {
  const config = ModelConfigSchema.parse(env);
  return new ChatOpenAI({
    apiKey: config.OPENROUTER_API_KEY,
    model: config.OPENROUTER_MODEL,
    configuration: { baseURL: "https://openrouter.ai/api/v1" },
    temperature: 0,
  });
}
