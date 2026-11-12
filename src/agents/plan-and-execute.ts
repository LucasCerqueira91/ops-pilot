import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { performance } from "node:perf_hooks";
import { z } from "zod";
import { createModel, LogicalModelCallCounter } from "./model.js";
import type { ReasoningStrategy, StrategyInput } from "./strategy.js";
import {
  contentToText,
  sanitizeTraceText,
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
import type { OperationsData } from "../store/seed-data.js";

const PlanOutputSchema = z
  .object({
    steps: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .describe("Um passo curto e executável usando as ferramentas disponíveis."),
      )
      .describe("Passos curtos, ordenados e executáveis."),
  })
  .strict();

const ExecutionSchema = z.discriminatedUnion("tool", [
  z.object({ tool: z.literal("list_alerts"), args: ListAlertsInputSchema }),
  z.object({ tool: z.literal("open_incident"), args: OpenIncidentInputSchema }),
  z.object({
    tool: z.literal("resolve_incident"),
    args: ResolveIncidentInputSchema,
  }),
]);

const ReplanOutputSchema = z
  .object({
    decision: z.enum(["adjust", "continue", "finish"]),
    steps: z.array(z.string().trim().min(1)),
    answer: z.string(),
  })
  .strict();

const StrategyInputSchema = z
  .object({
    prompt: z.string().trim().min(1),
    maxIterations: z.number().int().positive(),
  })
  .strict();

export const PLANNER_PROMPT =
  "Create short, ordered, executable operational steps using only these tools: list_alerts(status: firing|resolved|all), open_incident(title, service, severity), resolve_incident(id). Return only the steps; do not include private reasoning.";
export const EXECUTOR_PROMPT =
  "Resolve exactly the requested plan step into one available tool call. Use only service IDs, alert data, and incident IDs present in the supplied database snapshot. Never repeat a completed operation unless it is required. Do not invent records or expose private reasoning.";
export const REPLANNER_PROMPT =
  "Review the original request, current database, pending plan, and completed step/result pairs. Decide whether to adjust the pending plan, continue it unchanged, or finish. For adjust, return the replacement pending steps. For continue, return an empty steps array and retain the current pending plan. For finish, return a concise user-facing answer. Do not include private reasoning.";

export type ReplanDecision = z.infer<typeof ReplanOutputSchema>["decision"];

export interface PlannerContext {
  input: string;
}

export interface ExecutorContext {
  input: string;
  step: string;
  done: [string, string][];
  database: OperationsData;
}

export interface ReplannerContext {
  input: string;
  plan: string[];
  done: [string, string][];
  database: OperationsData;
}

export type Planner = (context: PlannerContext) => Promise<unknown>;
export type Executor = (context: ExecutorContext) => Promise<unknown>;
export type Replanner = (context: ReplannerContext) => Promise<unknown>;

export interface PlanAndExecuteOptions {
  store?: OperationsStore;
  planner?: Planner;
  executor?: Executor;
  replanner?: Replanner;
  modelFactory?: typeof createModel;
}

const State = Annotation.Root({
  input: Annotation<string>(),
  plan: Annotation<string[]>({
    reducer: (_current, update) => update,
    default: () => [],
  }),
  done: Annotation<[string, string][]>({
    reducer: (current, update) => current.concat(update),
    default: () => [],
  }),
  answer: Annotation<string>(),
  decision: Annotation<ReplanDecision>(),
  iteration: Annotation<number>(),
  trace: Annotation<TraceEvent[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
});

export function createPlanAndExecuteStrategy(
  options: PlanAndExecuteOptions = {},
): ReasoningStrategy {
  const store = options.store ?? new MemoryOperationsStore();
  const modelFactory = options.modelFactory ?? createModel;

  return {
    name: "plan-and-execute",
    async run(input: StrategyInput) {
      const { prompt, maxIterations } = StrategyInputSchema.parse(input);
      const started = performance.now();
      const maxActions = Math.min(maxIterations, 8);
      const tools = createOpsTools(store);
      const callCounter = new LogicalModelCallCounter();
      let llCalls = 0;
      const needsModel =
        !options.planner || !options.executor || !options.replanner;
      const model = needsModel ? modelFactory() : undefined;
      const planner =
        options.planner ??
        (model ? createModelPlanner(model, callCounter) : undefined);
      const executor =
        options.executor ??
        (model ? createModelExecutor(model, callCounter) : undefined);
      const replanner =
        options.replanner ??
        (model ? createModelReplanner(model, callCounter) : undefined);
      if (!planner || !executor || !replanner) {
        throw new Error("Plan-and-Execute model components are incomplete");
      }

      const planNode = async (state: typeof State.State) => {
        llCalls += 1;
        const output = PlanOutputSchema.parse(
          await planner({ input: state.input }),
        );
        const plan = output.steps.slice(0, 8);
        return {
          plan,
          trace: [{ type: "plan" as const, steps: plan }],
        };
      };

      const executeNode = async (state: typeof State.State) => {
        const step = state.plan[0];
        if (!step) throw new Error("Cannot execute an empty plan");
        const database = await loadDatabaseSnapshot(store);
        llCalls += 1;
        const action = ExecutionSchema.parse(
          await executor({
            input: state.input,
            step,
            done: state.done,
            database,
          }),
        );
        const result = await invokeTool(tools, action);
        const resultText = sanitizeTraceText(contentToText(result));
        return {
          plan: state.plan.slice(1),
          done: [[step, resultText] as [string, string]],
          iteration: state.iteration + 1,
          trace: [
            {
              type: "action" as const,
              tool: action.tool,
              args: action.args,
            },
            {
              type: "observation" as const,
              tool: action.tool,
              result: resultText,
            },
          ],
        };
      };

      const replanNode = async (state: typeof State.State) => {
        const database = await loadDatabaseSnapshot(store);
        llCalls += 1;
        const output = ReplanOutputSchema.parse(
          await replanner({
            input: state.input,
            plan: state.plan,
            done: state.done,
            database,
          }),
        );
        const nextPlan =
          output.decision === "adjust"
            ? output.steps.slice(0, Math.max(0, 8 - state.iteration))
            : state.plan;
        const answer =
          output.decision === "finish"
            ? sanitizeTraceText(output.answer.trim())
            : "";
        const trace: TraceEvent[] = [
          {
            type: "critique",
            summary: decisionSummary(output.decision),
          },
        ];
        if (output.decision === "adjust") {
          trace.push({ type: "plan", steps: nextPlan });
        }
        return {
          decision: output.decision,
          plan: nextPlan,
          answer,
          trace,
        };
      };

      const finishNode = (state: typeof State.State) => {
        const reachedLimit =
          state.iteration >= maxActions && state.decision !== "finish";
        const answer =
          state.answer ||
          (reachedLimit
            ? `The ${maxActions}-step limit was reached. The result is partial; see the completed steps.`
            : "No additional operational steps are required.");
        return {
          answer,
          trace: [{ type: "answer" as const, content: answer }],
        };
      };

      const graph = new StateGraph(State)
        .addNode("make-plan", planNode)
        .addNode("execute-step", executeNode)
        .addNode("replan-step", replanNode)
        .addNode("finalize", finishNode)
        .addEdge(START, "make-plan")
        .addConditionalEdges("make-plan", (state) =>
          state.plan.length > 0 ? "execute-step" : "finalize",
        )
        .addEdge("execute-step", "replan-step")
        .addConditionalEdges("replan-step", (state) =>
          state.decision !== "finish" &&
          state.plan.length > 0 &&
          state.iteration < maxActions
            ? "execute-step"
            : "finalize",
        )
        .addEdge("finalize", END)
        .compile();

      const result = await graph.invoke({
        input: prompt,
        plan: [],
        done: [],
        answer: "",
        decision: "continue",
        iteration: 0,
        trace: [],
      });

      return {
        answer: result.answer,
        trace: result.trace,
        metrics: {
          llCalls: Math.max(llCalls, callCounter.calls),
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
        ["system", PLANNER_PROMPT],
        ["human", context.input],
      ],
      { callbacks: [callCounter] },
    );
}

function createModelExecutor(
  model: ReturnType<typeof createModel>,
  callCounter: LogicalModelCallCounter,
): Executor {
  const structured = model.withStructuredOutput(ExecutionSchema, {
    name: "ops_tool_execution",
    strict: true,
  });
  return (context) =>
    structured.invoke(
      [
        ["system", EXECUTOR_PROMPT],
        [
          "human",
          JSON.stringify({
            request: context.input,
            step: context.step,
            done: context.done,
            database: context.database,
          }),
        ],
      ],
      { callbacks: [callCounter] },
    );
}

function createModelReplanner(
  model: ReturnType<typeof createModel>,
  callCounter: LogicalModelCallCounter,
): Replanner {
  const structured = model.withStructuredOutput(ReplanOutputSchema, {
    name: "ops_replan",
    strict: true,
  });
  return (context) =>
    structured.invoke(
      [
        ["system", REPLANNER_PROMPT],
        [
          "human",
          JSON.stringify({
            request: context.input,
            pendingPlan: context.plan,
            done: context.done,
            database: context.database,
          }),
        ],
      ],
      { callbacks: [callCounter] },
    );
}

async function loadDatabaseSnapshot(
  store: OperationsStore,
): Promise<OperationsData> {
  const [services, alerts, incidents] = await Promise.all([
    store.listServices(),
    store.listAlerts("all"),
    store.listIncidents(),
  ]);
  return { services, alerts, incidents };
}

function decisionSummary(decision: ReplanDecision): string {
  switch (decision) {
    case "adjust":
      return "The remaining plan was adjusted.";
    case "continue":
      return "The remaining plan will continue unchanged.";
    case "finish":
      return "The requested work is complete.";
  }
}

async function invokeTool(
  tools: ReturnType<typeof createOpsTools>,
  action: z.infer<typeof ExecutionSchema>,
): Promise<string> {
  switch (action.tool) {
    case "list_alerts":
      return tools.list_alerts.invoke(action.args);
    case "open_incident":
      return tools.open_incident.invoke(action.args);
    case "resolve_incident":
      return tools.resolve_incident.invoke(action.args);
  }
}
