import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";
import { z } from "zod";
import { createModel } from "./model.js";
import { createOperationsTools } from "./tool.js";
import type { OperationsService } from "../services/operations.js";
import type { TraceEvent } from "./trace.js";
import type { StrategyInput, StrategyResult } from "./strategy.js";
import type { ChatOpenAI } from "@langchain/openai";

const PEState = Annotation.Root({
  input: Annotation<string>(),
  plan: Annotation<string[]>({ reducer: (_left, right) => right, default: () => [] }),
  trace: Annotation<TraceEvent[]>({ reducer: (left, right) => left.concat(right), default: () => [] }),
  iterations: Annotation<number>({ reducer: (_left, right) => right, default: () => 0 }),
  llCalls: Annotation<number>({ reducer: (_left, right) => right, default: () => 0 }),
  answer: Annotation<string>({ reducer: (_left, right) => right, default: () => "" }),
  done: Annotation<boolean>({ reducer: (_left, right) => right, default: () => false }),
});

const planSchema = z.object({
  steps: z.array(z.string().trim().min(1)).min(0).max(8).describe("Passos curtos, ordenados e executáveis pelas ferramentas disponíveis"),
});
const replanSchema = z.object({
  remainingSteps: z.array(z.string().trim().min(1)).min(0).max(8),
  done: z.boolean(),
  critique: z.string().trim().min(1),
});

const PLANNER_PROMPT = `Você planeja operações de alertas e incidentes. Use somente estas tools: list_alerts(status firing|resolved), open_incident(title, service, severity), resolve_incident(id). Retorne entre zero e oito passos curtos e executáveis. Não invente IDs ou severidades desconhecidas. Consulte o estado antes de abrir ou resolver incidentes.`;
const REPLANNER_PROMPT = `Você ajusta o plano após executar exatamente um passo. Decida se a tarefa terminou, ajuste os passos restantes e justifique em uma crítica curta. Use entre zero e oito passos restantes. Se não houver steps, done deve ser true.`;

export interface PlanAndExecuteOptions {
  operations: OperationsService;
  model?: ChatOpenAI;
}

export async function runPlanAndExecute(input: StrategyInput, options: PlanAndExecuteOptions): Promise<StrategyResult> {
  const startedAt = performance.now();
  const model = options.model ?? createModel();
  const tools = createOperationsTools(options.operations);
  const toolByName = new Map<string, (typeof tools)[number]>(tools.map((item) => [item.name, item]));
  let llCalls = 0;

  async function planner(state: typeof PEState.State) {
    llCalls += 1;
    const structured = (model.withStructuredOutput as unknown as (schema: unknown) => { invoke(messages: unknown): Promise<unknown> })(planSchema);
    const result = await structured.invoke([
      ["system", PLANNER_PROMPT], ["user", state.input],
    ]);
    const plan = planSchema.parse(result).steps.slice(0, 8);
    return { plan, trace: [{ type: "plan" as const, steps: plan }], llCalls };
  }

  async function executor(state: typeof PEState.State) {
    if (state.done || state.plan.length === 0 || state.iterations >= 8) {
      return { done: true };
    }
    if (state.iterations >= 8) {
      return { done: true };
    }

    const step = state.plan[0];
    llCalls += 1;
    const toolModel = model.bindTools(tools);
    const response = await toolModel.invoke([
      ["system", "Execute somente o próximo passo usando uma tool. Não execute mais de uma tool. Se o passo não puder ser executado, responda sem tool_calls."],
      ["user", `Próximo passo: ${step}`],
    ]);

    const aiMessage = response as AIMessage;
    const calls = aiMessage.tool_calls ?? [];
    if (calls.length === 0) {
      const observation = typeof response.content === "string" ? response.content : "Nenhuma tool foi necessária para este passo.";
      return {
        plan: state.plan,
        iterations: state.iterations + 1,
        llCalls,
        trace: [{ type: "observation" as const, tool: "none", result: observation }],
      };
    }

    const call = calls[0];
    const selected = toolByName.get(call.name);
    if (!selected) throw new Error(`Unknown tool: ${call.name}`);
    const actionEvent: TraceEvent = { type: "action", tool: call.name, args: call.args };
    const result = await (selected as unknown as { invoke(input: unknown): Promise<unknown> }).invoke(call.args);
    const parsedResult = typeof result === "string" ? result : JSON.stringify(result);
    const observationEvent: TraceEvent = { type: "observation", tool: call.name, result: parsedResult };

    return {
      iterations: state.iterations + 1,
      llCalls,
      trace: [actionEvent, observationEvent],
    };
  }

  async function replanner(state: typeof PEState.State) {
    if (state.done || state.plan.length === 0 || state.iterations >= input.maxIterations || state.iterations >= 8) {
      const exhausted = state.iterations >= input.maxIterations || state.iterations >= 8;
      return { done: true, trace: [{ type: "critique" as const, critique: exhausted ? "Orçamento de execução encerrado; mantendo o resultado parcial." : "Não restam passos no plano." }], llCalls };
    }

    llCalls += 1;
    const structured = (model.withStructuredOutput as unknown as (schema: unknown) => { invoke(messages: unknown): Promise<unknown> })(replanSchema);
    const result = await structured.invoke([
      ["system", REPLANNER_PROMPT],
      ["user", `Pedido: ${state.input}\nPlano atual restante: ${JSON.stringify(state.plan)}\nTrace observado: ${JSON.stringify(state.trace)}\nIterações usadas: ${state.iterations}/${Math.min(input.maxIterations, 8)}`],
    ]);
    const replanned = replanSchema.parse(result);
    return {
      plan: replanned.done ? [] : replanned.remainingSteps.slice(0, 8),
      done: replanned.done,
      llCalls,
      trace: [{ type: "critique" as const, critique: replanned.done ? replanned.critique : `${replanned.critique} Plano ajustado para ${replanned.remainingSteps.length} passo(s).` }],
    };
  }

  async function finalizer(state: typeof PEState.State) {
    llCalls += 1;
    const result = await model.invoke([
      ["system", "Responda ao usuário de forma concisa, em português, usando apenas fatos observados no trace. Não exponha raciocínio oculto nem segredos."],
      ["user", `Pedido: ${state.input}\nTrace: ${JSON.stringify(state.trace)}\nResposta parcial permitida se o limite tiver sido atingido.`],
    ]);
    const answer = typeof result.content === "string" ? result.content : "Não foi possível obter uma resposta final.";
    return { answer, done: true, llCalls, trace: [{ type: "answer" as const, answer }] };
  }

  function routeAfterReplan(state: typeof PEState.State) {
    if (state.done || state.plan.length === 0 || state.iterations >= input.maxIterations || state.iterations >= 8) return "finalize";
    return "executor";
  }

  const graph = new StateGraph(PEState)
    .addNode("planner", planner)
    .addNode("executor", executor)
    .addNode("replanner", replanner)
    .addNode("finalizer", finalizer)
    .addEdge(START, "planner")
    .addEdge("planner", "executor")
    .addEdge("executor", "replanner")
    .addConditionalEdges("replanner", routeAfterReplan, { executor: "executor", finalize: "finalizer" })
    .addEdge("finalizer", END)
    .compile();

  const output = await graph.invoke(
    { input: input.prompt, plan: [], trace: [], iterations: 0, llCalls: 0, answer: "", done: false },
    { recursionLimit: Math.max(12, input.maxIterations * 4 + 8) },
  );

  return {
    answer: output.answer,
    trace: output.trace,
    metrics: { llCalls: output.llCalls, latencyMs: Math.max(0, Math.round(performance.now() - startedAt)) },
  };
}
