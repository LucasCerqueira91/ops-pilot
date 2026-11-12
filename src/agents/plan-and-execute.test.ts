import assert from "node:assert/strict";
import test from "node:test";
import { MemoryOperationsStore } from "../store/memory-store.js";
import {
  createPlanAndExecuteStrategy,
  type ReplannerContext,
} from "./plan-and-execute.js";

test("planner, executor, and replanner follow adjust and finish decisions", async () => {
  const store = new MemoryOperationsStore({
    createId: () => "00000000-0000-4000-8000-000000000010",
  });
  const plannerInputs: string[] = [];
  const executorSteps: string[] = [];
  const replanContexts: ReplannerContext[] = [];
  const strategy = createPlanAndExecuteStrategy({
    store,
    planner: async ({ input }) => {
      plannerInputs.push(input);
      return {
        steps: ["Check active alerts", "Open incident if needed"],
      };
    },
    executor: async ({ step, database }) => {
      executorSteps.push(step);
      assert.equal(database.services.length, 5);
      assert.equal(database.alerts.length, 6);
      if (step === "Check active alerts") {
        assert.equal(database.incidents.length, 0);
        return {
          tool: "list_alerts",
          args: { status: "firing" },
        };
      }
      assert.equal(database.incidents.length, 0);
      return {
        tool: "open_incident",
        args: {
          title: "Payment alerts require investigation",
          service: "payment-api",
          severity: "critical",
        },
      };
    },
    replanner: async (context) => {
      replanContexts.push(context);
      if (context.done.length === 1) {
        return {
          decision: "adjust",
          steps: ["Open incident for payments"],
          answer: "",
        };
      }
      return {
        decision: "finish",
        steps: [],
        answer: "Incident opened after reviewing active alerts.",
      };
    },
  });

  const result = await strategy.run({
    prompt: "Review firing alerts and respond to payment incidents",
    maxIterations: 8,
  });

  assert.deepEqual(plannerInputs, [
    "Review firing alerts and respond to payment incidents",
  ]);
  assert.deepEqual(executorSteps, [
    "Check active alerts",
    "Open incident for payments",
  ]);
  assert.deepEqual(
    replanContexts.map((context) => context.done.length),
    [1, 2],
  );
  assert.equal(replanContexts[0]?.plan[0], "Open incident if needed");
  assert.equal(replanContexts[1]?.database.incidents.length, 1);
  assert.equal(result.answer, "Incident opened after reviewing active alerts.");
  assert.equal(result.metrics.llCalls, 5);
  assert.deepEqual(
    result.trace.map((event) => event.type),
    [
      "plan",
      "action",
      "observation",
      "critique",
      "plan",
      "action",
      "observation",
      "critique",
      "answer",
    ],
  );
});

test("runs no more than eight steps when replans keep expanding the plan", async () => {
  let executions = 0;
  let replans = 0;
  const strategy = createPlanAndExecuteStrategy({
    store: new MemoryOperationsStore(),
    planner: async () => ({ steps: ["Check the current alerts"] }),
    executor: async ({ step }) => {
      executions += 1;
      return {
        tool: "list_alerts",
        args: { status: "firing" },
        summary: step,
      };
    },
    replanner: async ({ done }) => {
      replans += 1;
      assert.equal(done.length, replans);
      return {
        decision: "adjust",
        steps: Array.from({ length: 12 }, (_, index) => `Follow-up ${index + 1}`),
        answer: "",
      };
    },
  });

  const result = await strategy.run({
    prompt: "Review all alerts",
    maxIterations: 20,
  });
  const planEvents = result.trace.filter((event) => event.type === "plan");

  assert.equal(executions, 8);
  assert.equal(replans, 8);
  assert.equal(result.metrics.llCalls, 17);
  assert.ok(
    planEvents.every((event) => event.type !== "plan" || event.steps.length <= 8),
  );
  assert.equal(result.trace.filter((event) => event.type === "action").length, 8);
  assert.match(result.answer, /8-step limit/i);
});

test("keeps the existing plan when the replanner chooses continue", async () => {
  const executionPlan: string[] = [];
  const strategy = createPlanAndExecuteStrategy({
    store: new MemoryOperationsStore(),
    planner: async () => ({
      steps: ["First step", "Second step"],
    }),
    executor: async ({ step }) => {
      executionPlan.push(step);
      return {
        tool: "list_alerts",
        args: { status: "firing" },
        summary: step,
      };
    },
    replanner: async ({ plan }) => ({
      decision: plan.length === 1 ? "continue" : "finish",
      steps: [],
      answer: plan.length === 1 ? "" : "No additional work is required.",
    }),
  });

  const result = await strategy.run({
    prompt: "Check two items",
    maxIterations: 8,
  });

  assert.equal(executionPlan.length, 2);
  assert.deepEqual(executionPlan, ["First step", "Second step"]);
  assert.equal(result.answer, "No additional work is required.");
});
