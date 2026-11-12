import type { TraceEvent } from "./trace.js";

export const StrategyNameSchema = ["react", "plan-and-execute"] as const;
export type StrategyName = (typeof StrategyNameSchema)[number];

export interface StrategyInput {
  prompt: string;
  maxIterations: number;
}

export interface StrategyResult {
  answer: string;
  trace: TraceEvent[];
  metrics: {
    llCalls: number;
    latencyMs: number;
  };
}

export interface ReasoningStrategy {
  name: StrategyName;
  run(input: StrategyInput): Promise<StrategyResult>;
}
