import { AIMessage, HumanMessage, SystemMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";
import type { ChatOpenAI } from "@langchain/openai";
import { createModel } from "./model.js";
import { createOperationsTools } from "./tool.js";
import type { OperationsService } from "../services/operations.js";
import type { StrategyInput, StrategyResult } from "./strategy.js";
import type { TraceEvent } from "./trace.js";

export async function runReact(input: StrategyInput, options: { operations: OperationsService; model?: ChatOpenAI }): Promise<StrategyResult> {
  const startedAt = performance.now();
  const model = options.model ?? createModel();
  const tools = createOperationsTools(options.operations);
  const toolByName = new Map<string, (typeof tools)[number]>(tools.map((item) => [item.name, item]));
  const trace: TraceEvent[] = [];
  const messages: BaseMessage[] = [
    new SystemMessage("Você é um agente ReAct para alertas e incidentes. Use tools apenas quando necessário. Após receber uma observação, calcule a resposta solicitada e finalize sem chamar a mesma tool novamente. Não exponha raciocínio oculto."),
    new HumanMessage(input.prompt),
  ];
  let llCalls = 0;

  for (let iteration = 0; iteration < Math.min(input.maxIterations, 8); iteration += 1) {
    llCalls += 1;
    const response = await model.bindTools(tools).invoke(messages) as AIMessage;
    messages.push(response);
    const calls = response.tool_calls ?? [];
    if (calls.length === 0) {
      const answer = typeof response.content === "string" ? response.content : "Sem resposta textual.";
      trace.push({ type: "answer", answer });
      return { answer, trace, metrics: { llCalls, latencyMs: Math.max(0, Math.round(performance.now() - startedAt)) } };
    }
    const call = calls[0];
    const selected = toolByName.get(call.name);
    if (!selected) throw new Error(`Unknown tool: ${call.name}`);
    trace.push({ type: "action", tool: call.name, args: call.args });
    const result = await (selected as unknown as { invoke(input: unknown): Promise<unknown> }).invoke(call.args);
    const observation = typeof result === "string" ? result : JSON.stringify(result);
    trace.push({ type: "observation", tool: call.name, result: observation });
    messages.push(new ToolMessage(observation, call.id ?? call.name, call.name));
  }

  const answer = "Limite de iterações alcançado antes de uma resposta final.";
  trace.push({ type: "answer", answer });
  return { answer, trace, metrics: { llCalls, latencyMs: Math.max(0, Math.round(performance.now() - startedAt)) } };
}
