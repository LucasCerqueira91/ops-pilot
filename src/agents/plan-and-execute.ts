import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { performance } from "node:perf_hooks";
import { z } from "zod";
import { createModel, LogicalModelCallCounter } from "./model.js";
import type { ReasoningStrategy, StrategyInput } from "./strategy.js";
import {
  contentToText,
  sanitizeTraceText,
  type PlannedToolStep,
  type TraceEvent,
} from "./trace.js";
import type { OperationsStore } from "../store/operations-store.js";
import { MemoryOperationsStore } from "../store/memory-store.js";
import {
  ListAlertsInputSchema,
  OpenIncidentInputSchema,
  ResolveIncidentInputSchema,
  createOpsTools,
} from "./tool.js";

const ToolStepSchema = z.discriminatedUnion("tool", [
  z.object({
    tool: z.literal("list_alerts"),
    args: ListAlertsInputSchema,
  }),
  z.object({
    tool: z.literal("open_incident"),
    args: OpenIncidentInputSchema,
  }),
  z.object({
    tool: z.literal("resolve_incident"),
    args: ResolveIncidentInputSchema,
  }),
]);

const PlanOutputSchema = z
  .object({
    steps: z.array(ToolStepSchema),
    answer: z.string().trim().min(1),
  })
  .strict();

const StrategyInputSchema = z
  .object({
    prompt: z.string().trim().min(1),
    maxIterations: z.number().int().positive(),
  })
  .strict();

export interface PlannerContext {
  prompt: string;
  results: string[];
  remainingSteps: PlannedToolStep[];
}

export type Planner = (context: PlannerContext) => Promise<unknown>;

export interface PlanAndExecuteOptions {
  store?: OperationsStore;
  planner?: Planner;
}

const State = Annotation.Root({
  prompt: Annotation<string>(),
  iteration: Annotation<number>(),
  steps: Annotation<PlannedToolStep[]>(),
  results: Annotation<string[]>(),
  answer: Annotation<string>(),
  trace: Annotation<TraceEvent[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
});

export function createPlanAndExecuteStrategy(
  options: PlanAndExecuteOptions = {},
): ReasoningStrategy {
  const store = options.store ?? new MemoryOperationsStore();

  return {
    name: "plan-and-execute",
    async run(input: StrategyInput) {
      const { prompt, maxIterations } = StrategyInputSchema.parse(input);
      const started = performance.now();
      const tools = createOpsTools(store);
      let llCalls = 0;
      const callCounter = new LogicalModelCallCounter();
      const planner =
        options.planner ?? createModelPlanner(createModel(), callCounter);

      const callPlanner = async (context: PlannerContext) => {
        const callsBefore = callCounter.calls;
        const parsed = PlanOutputSchema.parse(await planner(context));
        llCalls += Math.max(1, callCounter.calls - callsBefore);
        return {
          steps: parsed.steps.slice(0, 8),
          answer: sanitizeTraceText(parsed.answer),
        };
      };

      const planNode = async (state: typeof State.State) => {
        const plan = await callPlanner({
          prompt: state.prompt,
          results: state.results,
          remainingSteps: [],
        });
        const planTrace: TraceEvent[] = [{ type: "plan", steps: plan.steps }];
        return { steps: plan.steps, answer: plan.answer, trace: planTrace };
      };

      const executeNode = async (state: typeof State.State) => {
        const step = ToolStepSchema.parse(state.steps[0]);
        const result = await invokeTool(tools, step);
        const resultText = sanitizeTraceText(contentToText(result));
        return {
          iteration: state.iteration + 1,
          steps: state.steps.slice(1),
          results: [...state.results, resultText],
          trace: [
            {
              type: "action" as const,
              tool: step.tool,
              args: step.args,
            },
            {
              type: "observation" as const,
              tool: step.tool,
              result: resultText,
            },
          ],
        };
      };

      const replanNode = async (state: typeof State.State) => {
        const plan = await callPlanner({
          prompt: state.prompt,
          results: state.results,
          remainingSteps: state.steps,
        });
        const planTrace: TraceEvent[] = [
          { type: "plan", steps: plan.steps },
          {
            type: "critique",
            summary: "Plan reviewed after the latest tool result.",
          },
        ];
        return {
          steps: plan.steps,
          answer: plan.answer,
          trace: planTrace,
        };
      };

      const finishNode = (state: typeof State.State) => {
        const answer =
          state.answer ||
          "Iteration limit reached; partial result available in the trace.";
        return {
          answer,
          trace: [{ type: "answer" as const, content: answer }],
        };
      };

      const graph = new StateGraph(State)
        .addNode("plan", planNode)
        .addNode("execute", executeNode)
        .addNode("replan", replanNode)
        .addNode("finish", finishNode)
        .addEdge(START, "plan")
        .addConditionalEdges("plan", (state) =>
          state.steps.length > 0 ? "execute" : "finish",
        )
        .addEdge("execute", "replan")
        .addConditionalEdges("replan", (state) =>
          state.steps.length > 0 && state.iteration < maxIterations
            ? "execute"
            : "finish",
        )
        .addEdge("finish", END)
        .compile();

      const result = await graph.invoke({
        prompt,
        iteration: 0,
        steps: [],
        results: [],
        answer: "",
        trace: [],
      });

      return {
        answer: result.answer,
        trace: result.trace,
        metrics: {
          llCalls,
          latencyMs: Math.max(0, performance.now() - started),
        },
      };
    },
  };
}

export const planAndExecuteStrategy = createPlanAndExecuteStrategy();

function createModelPlanner(
  model: ReturnType<typeof createModel>,
  callCounter: LogicalModelCallCounter,
): Planner {
  const structured = model.withStructuredOutput(PlanOutputSchema, {
    name: "ops_plan",
    strict: true,
  });
  return (context) =>
    structured.invoke(
      [
        [
          "system",
          "Plan safe operations using only the available tools. Return at most eight next steps and a concise user-facing answer. Do not include private reasoning.",
        ],
        [
          "human",
          JSON.stringify({
            request: context.prompt,
            previousResults: context.results,
            remainingSteps: context.remainingSteps,
          }),
        ],
      ],
      { callbacks: [callCounter] },
    );
}

async function invokeTool(
  tools: ReturnType<typeof createOpsTools>,
  step: PlannedToolStep,
): Promise<string> {
  switch (step.tool) {
    case "list_alerts":
      return tools.list_alerts.invoke(step.args);
    case "open_incident":
      return tools.open_incident.invoke(step.args);
    case "resolve_incident":
      return tools.resolve_incident.invoke(step.args);
  }
}
