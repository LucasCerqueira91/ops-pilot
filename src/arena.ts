import { resolve } from "node:path";
import { copyFileSync } from "node:fs";
import { z } from "zod";
import { MemoryOperationsStore } from "./store/memory-store.js";
import { OperationsService } from "./services/operations.js";
import { runPlanAndExecute } from "./agents/plan-and-execute.js";
import { runReact } from "./agents/react.js";
import type { StrategyName, StrategyResult } from "./agents/strategy.js";

const CliSchema = z.object({ strategies: z.array(z.enum(["react", "plan-and-execute"])).min(1), maxIterations: z.number().int().positive().max(8), prompt: z.string().trim().min(1) });

function parseArgs(argv: string[]) {
  let strategies: StrategyName[] | undefined;
  let maxIterations = 5;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--strategies") {
      const value = argv[++i];
      if (!value) throw new Error("--strategies requer uma lista");
      strategies = value.split(",").map((item) => item.trim()).filter(Boolean) as StrategyName[];
    } else if (arg === "--max-iterations") {
      maxIterations = Number(argv[++i]);
    } else if (arg.startsWith("--")) {
      throw new Error(`Flag desconhecida: ${arg}`);
    } else {
      positional.push(arg);
    }
  }
  return CliSchema.parse({ strategies: strategies ?? ["react", "plan-and-execute"], maxIterations, prompt: positional.join(" ").trim() });
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const config = parseArgs(argv);
  const seedPath = resolve(process.cwd(), "src/store/seed-data.json");
  const runtimePath = resolve(process.cwd(), "src/store/runtime-state.json");

  for (const strategy of config.strategies) {
    copyFileSync(seedPath, runtimePath);
    const store = new MemoryOperationsStore(runtimePath);
    const operations = new OperationsService(store);
    const input = { prompt: config.prompt, maxIterations: config.maxIterations };
    const result: StrategyResult = strategy === "react"
      ? await runReact(input, { operations })
      : await runPlanAndExecute(input, { operations });
    printResult(strategy, result);
  }
}

function formatArgs(args: Record<string, unknown>): string {
  return Object.entries(args).map(([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`).join(", ");
}

function formatTraceEvent(event: StrategyResult["trace"][number]): string | null {
  switch (event.type) {
    case "plan":
      return `Plano: ${event.steps.length} passo(s) — ${event.steps.join(" → ")}`;
    case "action":
      return `Ação: ${event.tool} (${formatArgs(event.args)})`;
    case "observation":
      return `Resultado: ${event.tool}`;
    case "critique":
      return `Replanejamento: ${event.critique}`;
    case "thought":
      return `Resumo: ${event.thought}`;
    case "answer":
      return null;
  }
}

function printResult(strategy: StrategyName, result: StrategyResult): void {
  console.log(`\n=== ${strategy === "react" ? "ReAct" : "Plan-and-Execute"} ===`);
  console.log(`\nResposta:\n${result.answer}`);

  const traceLines = result.trace.map(formatTraceEvent).filter((line): line is string => line !== null);
  if (traceLines.length > 0) {
    console.log("\nExecução:");
    for (const line of traceLines) console.log(`  • ${line}`);
  }

  console.log(`\nMétricas: ${result.metrics.llCalls} chamada(s) ao modelo · ${(result.metrics.latencyMs / 1000).toFixed(2)} s`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
