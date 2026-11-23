export type TraceEvent =
  | { type: "thought"; thought: string }
  | { type: "action"; tool: string; args: Record<string, unknown> }
  | { type: "observation"; tool: string; result: unknown }
  | { type: "plan"; steps: string[] }
  | { type: "critique"; critique: string }
  | { type: "answer"; answer: string };
