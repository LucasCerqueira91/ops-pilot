import { z } from "zod";
import { createPlanAndExecuteStrategy } from "../agents/plan-and-execute.js";
import { createReactStrategy } from "../agents/react.js";
import type {
  ReasoningStrategy,
  StrategyName,
  StrategyResult,
} from "../agents/strategy.js";
import { StrategyNameSchema } from "../agents/strategy.js";
import { JsonOperationsStore } from "../store/json-store.js";
import type { OperationsStore } from "../store/operations-store.js";
import { formatTrace } from "../views/trace.js";

const ArenaOptionsSchema = z
  .object({
    strategies: z.array(z.enum(StrategyNameSchema)).min(1),
    maxIterations: z.number().int().positive(),
    prompt: z.string().trim().min(1),
  })
  .strict();

export interface ArenaOptions {
  strategies: StrategyName[];
  maxIterations: number;
  prompt: string;
}

export interface ArenaRunResult {
  name: StrategyName;
  result: StrategyResult;
}

export interface ArenaDependencies {
  createStore: () => OperationsStore | Promise<OperationsStore>;
  createStrategy: (
    name: StrategyName,
    store: OperationsStore,
  ) => ReasoningStrategy;
}

const defaultDependencies: ArenaDependencies = {
  createStore: () => JsonOperationsStore.open(),
  createStrategy: (name, store) =>
    name === "react"
      ? createReactStrategy({ store })
      : createPlanAndExecuteStrategy({ store }),
};

export function parseArenaArgs(args: readonly string[]): ArenaOptions {
  let strategiesValue: string | undefined;
  let maxIterationsValue: string | undefined;
  const promptParts: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--strategies" || argument === "--max-iterations") {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`Missing value for ${argument}`);
      }
      if (argument === "--strategies") {
        if (strategiesValue !== undefined) {
          throw new Error("--strategies may only be specified once");
        }
        strategiesValue = value;
      } else {
        if (maxIterationsValue !== undefined) {
          throw new Error("--max-iterations may only be specified once");
        }
        maxIterationsValue = value;
      }
      index += 1;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else {
      promptParts.push(argument);
    }
  }

  const strategies =
    strategiesValue === undefined
      ? [...StrategyNameSchema]
      : strategiesValue.split(",").map((name) => {
          const parsed = z.enum(StrategyNameSchema).safeParse(name.trim());
          if (!parsed.success) {
            throw new Error(`Unknown strategy: ${name}`);
          }
          return parsed.data;
        });
  const maxIterations =
    maxIterationsValue === undefined
      ? 5
      : z.coerce.number().int().positive().parse(maxIterationsValue);
  return ArenaOptionsSchema.parse({
    strategies,
    maxIterations,
    prompt: promptParts.join(" "),
  });
}

export async function executeArena(
  args: readonly string[],
  dependencies: ArenaDependencies = defaultDependencies,
): Promise<{ options: ArenaOptions; results: ArenaRunResult[] }> {
  const options = parseArenaArgs(args);
  const results: ArenaRunResult[] = [];

  for (const name of options.strategies) {
    const store = await dependencies.createStore();
    const strategy = dependencies.createStrategy(name, store);
    const result = await strategy.run({
      prompt: options.prompt,
      maxIterations: options.maxIterations,
    });
    results.push({ name, result });
  }
  return { options, results };
}

export async function runArenaController(
  args: readonly string[] = process.argv.slice(2),
): Promise<void> {
  const { results } = await executeArena(args);
  for (const { name, result } of results) {
    console.log(`\n=== ${name} ===`);
    console.log(`Resposta: ${result.answer}`);
    console.log(`Trace:\n${formatTrace(result.trace)}`);
    console.log(
      `Métricas: llCalls=${result.metrics.llCalls}, latencyMs=${result.metrics.latencyMs.toFixed(2)}`,
    );
  }
}
