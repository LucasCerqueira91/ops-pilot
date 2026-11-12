import type { CreateIncident, Severity } from "../models/domain.js";
import type { AlertStatus } from "../models/domain.js";

export type PlannedToolStep =
  | {
      tool: "list_alerts";
      args: { status: AlertStatus | "all" };
    }
  | {
      tool: "open_incident";
      args: { title: string; service: string; severity: Severity };
    }
  | {
      tool: "resolve_incident";
      args: { id: string };
    };

export type TraceEvent =
  | { type: "thought"; summary: string }
  | { type: "action"; tool: PlannedToolStep["tool"]; args: Record<string, unknown> }
  | { type: "observation"; tool: PlannedToolStep["tool"]; result: string }
  | { type: "plan"; steps: PlannedToolStep[] }
  | { type: "critique"; summary: string }
  | { type: "answer"; content: string };

export type { CreateIncident };

export function sanitizeTraceText(value: string): string {
  return value
    .replace(
      /\b(OPENROUTER_API_KEY|MYSQL_PASSWORD)\s*[:=]\s*["']?[^"' \r\n,;]+["']?/gi,
      "$1=[REDACTED]",
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[REDACTED]");
}

export function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (
        typeof part === "object" &&
        part !== null &&
        "text" in part &&
        typeof part.text === "string"
      ) {
        return part.text;
      }
      return "";
    })
    .join("");
}

export function sanitizeTraceValue(value: unknown): unknown {
  if (typeof value === "string") return sanitizeTraceText(value);
  if (Array.isArray(value)) return value.map(sanitizeTraceValue);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sanitizeTraceValue(item),
      ]),
    );
  }
  return value;
}
