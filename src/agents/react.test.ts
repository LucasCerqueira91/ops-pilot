import assert from "node:assert/strict";
import test from "node:test";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import type { Serialized } from "@langchain/core/load/serializable";
import { ChatOpenAI } from "@langchain/openai";
import { GraphRecursionError } from "@langchain/langgraph";
import { MemoryOperationsStore } from "../store/memory-store.js";
import { createReactStrategy } from "./react.js";

test("ReAct uses the prebuilt graph, records ordered actions, and counts model calls", async () => {
  let receivedInput: unknown;
  let receivedRecursionLimit = 0;
  let callbackCount = 0;
  let modelCallbacks = 0;
  const strategy = createReactStrategy({
    store: new MemoryOperationsStore(),
    modelFactory: () =>
      new ChatOpenAI({
        model: "test-model",
        apiKey: "test-key-not-for-network-use",
      }),
    agentFactory: (model, tools) => {
      assert.ok(model instanceof ChatOpenAI);
      assert.equal(tools.length, 3);
      return {
        async *stream(input, config) {
          receivedInput = input;
          receivedRecursionLimit = config.recursionLimit;
          callbackCount = config.callbacks.length;
          const serialized = {
            lc: 1,
            type: "not_implemented",
            id: [],
          } satisfies Serialized;
          for (let index = 0; index < 2; index += 1) {
            config.callbacks[0]?.handleChatModelStart?.(
              serialized,
              [],
              `run-${index}`,
            );
            modelCallbacks += 1;
          }
          yield {
            messages: [
              new HumanMessage("list firing alerts"),
              new AIMessage({
                content: "private reasoning: do not expose this text",
                tool_calls: [
                  {
                    id: "call-1",
                    name: "list_alerts",
                    args: { status: "firing" },
                    type: "tool_call",
                  },
                ],
              }),
              new ToolMessage({
                content: '[{"id":"alert-1","status":"firing"}]',
                tool_call_id: "call-1",
                name: "list_alerts",
              }),
              new AIMessage("Há um alerta ativo."),
            ],
          };
        },
      };
    },
  });

  const result = await strategy.run({
    prompt: "list firing alerts",
    maxIterations: 1,
  });

  assert.deepEqual(receivedInput, {
    messages: [new HumanMessage("list firing alerts")],
  });
  assert.equal(receivedRecursionLimit, 3);
  assert.equal(callbackCount, 1);
  assert.equal(modelCallbacks, 2);
  assert.equal(result.answer, "Há um alerta ativo.");
  assert.equal(result.metrics.llCalls, 2);
  assert.ok(result.metrics.latencyMs >= 0);
  assert.deepEqual(
    result.trace.map((event) => event.type),
    ["action", "observation", "answer"],
  );
  assert.doesNotMatch(JSON.stringify(result.trace), /private reasoning/i);
});

test("returns the partial trace when the graph recursion safety limit is reached", async () => {
  const strategy = createReactStrategy({
    modelFactory: () =>
      new ChatOpenAI({
        model: "test-model",
        apiKey: "test-key-not-for-network-use",
      }),
    agentFactory: () => ({
      async *stream() {
        yield {
          messages: [
            new HumanMessage("keep checking"),
            new AIMessage({
              content: "",
              tool_calls: [
                {
                  id: "call-1",
                  name: "list_alerts",
                  args: { status: "firing" },
                  type: "tool_call",
                },
              ],
            }),
          ],
        };
        throw new GraphRecursionError("Graph recursion limit reached");
      },
    }),
  });

  const result = await strategy.run({
    prompt: "keep checking",
    maxIterations: 1,
  });

  assert.match(result.answer, /partial result/i);
  assert.deepEqual(
    result.trace.map((event) => event.type),
    ["action", "answer"],
  );
});

test("reports an empty final model response instead of returning a blank answer", async () => {
  const strategy = createReactStrategy({
    modelFactory: () =>
      new ChatOpenAI({
        model: "test-model",
        apiKey: "test-key-not-for-network-use",
      }),
    agentFactory: () => ({
      async *stream() {
        yield {
          messages: [
            new HumanMessage("count critical alerts"),
            new AIMessage(""),
          ],
        };
      },
    }),
  });

  await assert.rejects(
    strategy.run({
      prompt: "count critical alerts",
      maxIterations: 1,
    }),
    /OpenRouter returned an empty response/,
  );
});
