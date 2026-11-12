# Reasoning Strategy Contract

## Common interface

Every strategy exposes a stable name and an asynchronous `run(input)` operation.

```ts
type StrategyName = "react" | "plan-and-execute";

interface StrategyInput {
  prompt: string;
  maxIterations: number;
}

interface StrategyResult {
  answer: string;
  trace: TraceEvent[];
  metrics: {
    llCalls: number;
    latencyMs: number;
  };
}
```

`maxIterations` is a positive integer validated at the CLI boundary. It limits
tool/action work cycles; it is not the same as `llCalls`. Plan-and-Execute caps total executed tool steps at eight, including any
replacement steps returned by the replanner.

## Trace events

- `thought`: optional high-level operational summary, never hidden
  chain-of-thought.
- `action`: `{ tool, args }`.
- `observation`: `{ tool, result }`, sanitized before recording.
- `plan`: ordered list of concise textual steps.
- `critique`: concise replan outcome, not raw private reasoning.
- `answer`: final user-facing response.

Trace events are ordered by occurrence. `llCalls` counts logical LangChain
model invocations (including planning and replanning), not provider retry
attempts. `latencyMs` measures the full strategy run.

## Limits and failure behavior

- A strategy never executes more action cycles than `maxIterations`.
- Plan-and-Execute never executes more than eight actions in total.
- The planner returns text steps, the executor resolves one step to one
  validated tool call, and stores the step/result pair in `done`.
- After each tool execution, the replanner chooses `adjust`, `continue`, or
  `finish`; `continue` retains the pending plan.
- A separate LangGraph recursion limit prevents runaway graph transitions.
- If an iteration budget is exhausted, return a user-visible partial result
  and the trace accumulated so far.
- Invalid structured model output is rejected by Zod; it is not silently
  converted to a successful result.
- Unexpected model, tool, or persistence errors remain explicit at the
  controller boundary.
