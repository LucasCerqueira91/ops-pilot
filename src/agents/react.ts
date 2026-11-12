import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { GraphRecursionError } from "@langchain/langgraph";
import { performance } from "node:perf_hooks";
import { z } from "zod";
import { createModel, LogicalModelCallCounter } from "./model.js";
import type { ReasoningStrategy, StrategyInput } from "./strategy.js";
import {
  contentToText,
  sanitizeTraceText,
  sanitizeTraceValue,
  type TraceEvent,
} from "./trace.js";
import type { OperationsStore } from "../store/operations-store.js";
import { MemoryOperationsStore } from "../store/memory-store.js";
import { createOpsTools } from "./tool.js";

const StrategyInputSchema = z
  .object({
    prompt: z.string().trim().min(1),
    maxIterations: z.number().int().positive(),
  })
  .strict();

interface AgentState {
  messages: BaseMessage[];
}

interface ReactAgentRunner {
  stream(
    input: { messages: HumanMessage[] },
    config: {
      recursionLimit: number;
      streamMode: "values";
      callbacks: BaseCallbackHandler[];
    },
  ): Promise<AsyncIterable<AgentState>> | AsyncIterable<AgentState>;
}

type AgentFactory = (
  model: ReturnType<typeof createModel>,
  tools: StructuredToolInterface[],
) => ReactAgentRunner;

export interface ReactStrategyOptions {
  store?: OperationsStore;
  modelFactory?: typeof createModel;
  agentFactory?: AgentFactory;
}

const defaultAgentFactory: AgentFactory = (model, tools) => {
  const agent = createReactAgent({
    llm: model,
    tools,
    prompt:
      "You are OpsPilot, an operations assistant. Use only the available tools for operational changes. Do not reveal private reasoning or credentials. Give a concise final answer.",
  });
  return {
    stream: async (input, config) =>
      (await agent.stream(input, {
        ...config,
        streamMode: "values",
      })) as AsyncIterable<AgentState>,
  };
};

export function createReactStrategy(
  options: ReactStrategyOptions = {},
): ReasoningStrategy {
  const store = options.store ?? new MemoryOperationsStore();
  const modelFactory = options.modelFactory ?? createModel;
  const agentFactory = options.agentFactory ?? defaultAgentFactory;

  return {
    name: "react",
    async run(input: StrategyInput) {
      const { prompt, maxIterations } = StrategyInputSchema.parse(input);
      const started = performance.now();
      const tools = Object.values(createOpsTools(store));
      const model = modelFactory();
      const agent = agentFactory(model, tools);
      const recursionLimit = 2 * maxIterations + 1;
      const callCounter = new LogicalModelCallCounter();
      let messages: BaseMessage[] = [];

      try {
        for await (const state of await agent.stream(
          { messages: [new HumanMessage(prompt)] },
          {
            recursionLimit,
            streamMode: "values",
            callbacks: [callCounter],
          },
        )) {
          messages = state.messages;
        }
      } catch (error) {
        if (!(error instanceof GraphRecursionError)) throw error;
      }

      const trace = toTrace(messages);
      const answerMessage = [...messages]
        .reverse()
        .find(
          (message) =>
            message instanceof AIMessage &&
            (message.tool_calls ?? []).length === 0,
        );
      const answer = answerMessage
        ? sanitizeTraceText(contentToText(answerMessage.content))
        : "Iteration limit reached; partial result available in the trace.";
      if (!trace.some((event) => event.type === "answer")) {
        trace.push({ type: "answer", content: answer });
      }

      return {
        answer,
        trace,
        metrics: {
          llCalls:
            callCounter.calls ||
            messages.filter((message) => message instanceof AIMessage).length,
          latencyMs: Math.max(0, performance.now() - started),
        },
      };
    },
  };
}

function toTrace(messages: BaseMessage[]): TraceEvent[] {
  const trace: TraceEvent[] = [];
  for (const message of messages) {
    if (message instanceof AIMessage) {
      for (const call of message.tool_calls ?? []) {
        const toolName = z
          .enum(["list_alerts", "open_incident", "resolve_incident"])
          .parse(call.name);
        trace.push({
          type: "action",
          tool: toolName,
          args: z
            .record(z.string(), z.unknown())
            .parse(sanitizeTraceValue(call.args)),
        });
      }
      if ((message.tool_calls ?? []).length === 0) {
        const content = sanitizeTraceText(contentToText(message.content));
        if (content) trace.push({ type: "answer", content });
      }
      continue;
    }
    if (message instanceof ToolMessage) {
      trace.push({
        type: "observation",
        tool: z
          .enum(["list_alerts", "open_incident", "resolve_incident"])
          .parse(message.name),
        result: sanitizeTraceText(contentToText(message.content)),
      });
    }
  }
  return trace;
}

export const reactStrategy = createReactStrategy();
