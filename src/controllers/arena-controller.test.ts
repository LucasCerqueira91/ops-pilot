import assert from "node:assert/strict";
import test from "node:test";
import { MemoryOperationsStore } from "../store/memory-store.js";
import {
  executeArena,
  parseArenaArgs,
} from "./arena-controller.js";

test("validates strategy selection and iteration limits", () => {
  assert.deepEqual(
    parseArenaArgs(["list", "alerts"]),
    {
      strategies: ["react", "plan-and-execute"],
      maxIterations: 5,
      prompt: "list alerts",
    },
  );
  assert.throws(() => parseArenaArgs(["--strategies", "", "request"]));
  assert.throws(() =>
    parseArenaArgs(["--strategies", "unknown", "request"]),
  );
  assert.throws(() =>
    parseArenaArgs(["--max-iterations", "0", "request"]),
  );
  assert.throws(() => parseArenaArgs(["--unknown", "request"]));
});

test("runs selected strategies with the same request and isolated stores", async () => {
  const stores: MemoryOperationsStore[] = [];
  const prompts: string[] = [];
  const result = await executeArena(
    [
      "--strategies",
      "react,plan-and-execute",
      "--max-iterations",
      "2",
      "inspect firing alerts",
    ],
    {
      createStore: () => {
        const store = new MemoryOperationsStore();
        stores.push(store);
        return store;
      },
      createStrategy: (name) => ({
        name,
        run: async ({ prompt }) => {
          prompts.push(prompt);
          return {
            answer: `${name} complete`,
            trace: [{ type: "answer", content: `${name} complete` }],
            metrics: { llCalls: 1, latencyMs: 1 },
          };
        },
      }),
    },
  );

  assert.deepEqual(prompts, [
    "inspect firing alerts",
    "inspect firing alerts",
  ]);
  assert.equal(stores.length, 2);
  assert.notEqual(stores[0], stores[1]);
  assert.equal(result.results.length, 2);
});
