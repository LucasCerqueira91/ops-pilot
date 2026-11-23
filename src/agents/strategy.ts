import type { TraceEvent } from "./trace.js";

export type StrategyName = "react" | "plan-and-execute";
export interface StrategyInput { prompt: string; maxIterations: number }
export interface StrategyResult { answer: string; trace: TraceEvent[]; metrics: { llCalls: number; latencyMs: number } }
