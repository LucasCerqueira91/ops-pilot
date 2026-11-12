import assert from "node:assert/strict";
import test from "node:test";
import { formatTrace } from "./trace.js";
import type { TraceEvent } from "../agents/trace.js";

test("formats each trace variant in order with action arguments", () => {
  const trace: TraceEvent[] = [
    { type: "thought", summary: "Consultar alertas ativos." },
    {
      type: "plan",
      steps: [
        {
          tool: "list_alerts",
          args: { status: "firing" },
        },
      ],
    },
    {
      type: "action",
      tool: "list_alerts",
      args: { status: "firing" },
    },
    {
      type: "observation",
      tool: "list_alerts",
      result: '[{"id":"alert-1"}]',
    },
    { type: "critique", summary: "Nenhuma ação adicional necessária." },
    { type: "answer", content: "Há um alerta ativo." },
  ];

  const formatted = formatTrace(trace);

  assert.match(formatted, /Pensamento/);
  assert.match(formatted, /Plano/);
  assert.match(formatted, /Ação: list_alerts/);
  assert.match(formatted, /"status":"firing"/);
  assert.match(formatted, /Observação/);
  assert.match(formatted, /Crítica/);
  assert.match(formatted, /Resposta: Há um alerta ativo/);
  assert.deepEqual(
    formatted.split("\n").map((line) => line.split(":")[0]),
    ["Pensamento", "Plano", "Ação", "Observação", "Crítica", "Resposta"],
  );
});

test("redacts credential-like values before rendering", () => {
  const formatted = formatTrace([
    {
      type: "observation",
      tool: "list_alerts",
      result: "Authorization: Bearer secret-token",
    },
    { type: "answer", content: "OPENROUTER_API_KEY=secret-value" },
  ]);

  assert.doesNotMatch(formatted, /secret-token|secret-value/);
  assert.match(formatted, /\[REDACTED\]/);
});
