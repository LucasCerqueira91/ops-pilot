import {
  BaseCallbackHandler,
  type CallbackHandlerMethods,
} from "@langchain/core/callbacks/base";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

const ModelEnvironmentSchema = z
  .object({
    OPENROUTER_API_KEY: z.string().trim().min(1),
    OPENROUTER_MODEL: z.string().trim().min(1),
  })
  .strict();

export interface ModelConfiguration {
  model: string;
  apiKey: string;
  configuration: { baseURL: string };
  modelKwargs: { parallel_tool_calls: false };
  temperature: 0;
}

export class LogicalModelCallCounter extends BaseCallbackHandler {
  name = "ops-pilot-model-call-counter";
  calls = 0;

  override handleChatModelStart(
    ..._args: Parameters<
      NonNullable<CallbackHandlerMethods["handleChatModelStart"]>
    >
  ): void {
    this.calls += 1;
  }
}

export function getModelConfiguration(
  environment: Record<string, string | undefined> = process.env,
): ModelConfiguration {
  const values = ModelEnvironmentSchema.parse({
    OPENROUTER_API_KEY: environment.OPENROUTER_API_KEY,
    OPENROUTER_MODEL: environment.OPENROUTER_MODEL,
  });
  return {
    model: values.OPENROUTER_MODEL,
    apiKey: values.OPENROUTER_API_KEY,
    configuration: { baseURL: "https://openrouter.ai/api/v1" },
    modelKwargs: { parallel_tool_calls: false },
    temperature: 0,
  };
}

export function createModel(
  environment: Record<string, string | undefined> = process.env,
): ChatOpenAI {
  return new ChatOpenAI(getModelConfiguration(environment));
}
