import { z } from "zod";

export const SeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const ServiceSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
});
export type Service = z.infer<typeof ServiceSchema>;

export const AlertSchema = z.object({
  id: z.string().trim().min(1),
  serviceId: z.string().trim().min(1),
  title: z.string().trim().min(1),
  status: z.enum(["firing", "resolved"]),
  severity: SeveritySchema,
  triggeredAt: z.string().min(1),
  resolvedAt: z.string().nullable(),
}).superRefine((alert, ctx) => {
  if (alert.status === "resolved" && !alert.resolvedAt) ctx.addIssue({ code: "custom", message: "Resolved alerts require resolvedAt", path: ["resolvedAt"] });
  if (alert.status === "firing" && alert.resolvedAt !== null) ctx.addIssue({ code: "custom", message: "Firing alerts must have resolvedAt null", path: ["resolvedAt"] });
});
export type Alert = z.infer<typeof AlertSchema>;

export const IncidentSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1),
  serviceId: z.string().trim().min(1),
  severity: SeveritySchema,
  status: z.enum(["open", "resolved"]),
  createdAt: z.string().min(1),
  resolvedAt: z.string().nullable(),
}).superRefine((incident, ctx) => {
  if (incident.status === "resolved" && !incident.resolvedAt) ctx.addIssue({ code: "custom", message: "Resolved incidents require resolvedAt", path: ["resolvedAt"] });
  if (incident.status === "open" && incident.resolvedAt !== null) ctx.addIssue({ code: "custom", message: "Open incidents must have resolvedAt null", path: ["resolvedAt"] });
});
export type Incident = z.infer<typeof IncidentSchema>;
