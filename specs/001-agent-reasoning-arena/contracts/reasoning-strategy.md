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
tool/action work cycles; it is not the same as `llCalls`. Plan-and-Execute
additionally caps plans at eight steps.

## Trace events

- `thought`: optional high-level operational summary, never hidden
  chain-of-thought.
- `action`: `{ tool, args }`.
- `observation`: `{ tool, result }`, sanitized before recording.
- `plan`: ordered list of no more than eight steps.
- `critique`: concise replan outcome, not raw private reasoning.
- `answer`: final user-facing response.

Trace events are ordered by occurrence. `llCalls` counts logical LangChain
model invocations (including planning and replanning), not provider retry
attempts. `latencyMs` measures the full strategy run.

## Limits and failure behavior

- A strategy never executes more action cycles than `maxIterations`.
- A separate LangGraph recursion limit prevents runaway graph transitions.
- If an iteration budget is exhausted, return a user-visible partial result
  and the trace accumulated so far.
- Invalid structured model output is rejected by Zod; it is not silently
  converted to a successful result.
- Unexpected model, tool, or persistence errors remain explicit at the
  controller boundary.
