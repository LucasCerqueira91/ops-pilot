import {
  sanitizeTraceText,
  sanitizeTraceValue,
  type TraceEvent,
} from "../agents/trace.js";

export function formatTrace(trace: readonly TraceEvent[]): string {
  return trace.map(formatEvent).join("\n");
}

function formatEvent(event: TraceEvent): string {
  switch (event.type) {
    case "thought":
      return `Pensamento: ${sanitizeTraceText(event.summary)}`;
    case "action":
      return `Ação: ${event.tool} ${JSON.stringify(sanitizeTraceValue(event.args))}`;
    case "observation":
      return `Observação: ${event.tool} ${sanitizeTraceText(event.result)}`;
    case "plan":
      return `Plano: ${JSON.stringify(sanitizeTraceValue(event.steps))}`;
    case "critique":
      return `Crítica: ${sanitizeTraceText(event.summary)}`;
    case "answer":
      return `Resposta: ${sanitizeTraceText(event.content)}`;
  }
}
