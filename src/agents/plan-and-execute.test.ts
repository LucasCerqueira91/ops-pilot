import assert from "node:assert/strict";
import test from "node:test";
import { MemoryOperationsStore } from "../store/memory-store.js";
import { createPlanAndExecuteStrategy } from "./plan-and-execute.js";

test("plans one action at a time, replans after it, and returns typed metrics", async () => {
  let plannerCalls = 0;
  const strategy = createPlanAndExecuteStrategy({
    store: new MemoryOperationsStore(),
    planner: async ({ prompt, results }) => {
      plannerCalls += 1;
      assert.equal(prompt, "list firing alerts");
      if (results.length === 0) {
        return {
          steps: [
            { tool: "list_alerts", args: { status: "firing" } },
            { tool: "list_alerts", args: { status: "resolved" } },
          ],
          answer: "A revisão terminou.",
        };
      }
      assert.equal(results.length, 1);
      return {
        steps: [],
        answer: "Há três alertas ativos.",
      };
    },
  });

  const result = await strategy.run({
    prompt: "list firing alerts",
    maxIterations: 3,
  });

  assert.equal(plannerCalls, 2);
  assert.equal(result.answer, "Há três alertas ativos.");
  assert.equal(result.metrics.llCalls, 2);
  assert.ok(result.metrics.latencyMs >= 0);
  assert.deepEqual(
    result.trace.map((event) => event.type),
    ["plan", "action", "observation", "plan", "critique", "answer"],
  );
});

test("caps plans at eight steps and stops at the iteration budget", async () => {
  let calls = 0;
  const strategy = createPlanAndExecuteStrategy({
    store: new MemoryOperationsStore(),
    planner: async () => {
      calls += 1;
      return {
        steps: Array.from({ length: 10 }, () => ({
          tool: "list_alerts" as const,
          args: { status: "firing" as const },
        })),
        answer: "Execução parcial.",
      };
    },
  });

  const result = await strategy.run({
    prompt: "review alerts",
    maxIterations: 1,
  });
  const plans = result.trace.filter((event) => event.type === "plan");

  assert.equal(calls, 2);
  assert.ok(
    plans.every((event) => event.type !== "plan" || event.steps.length <= 8),
  );
  assert.equal(
    result.trace.filter((event) => event.type === "action").length,
    1,
  );
  assert.equal(result.answer, "Execução parcial.");
});
