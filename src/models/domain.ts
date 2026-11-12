import { z } from "zod";

export const SeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export const AlertStatusSchema = z.enum(["firing", "resolved"]);
export const IncidentStatusSchema = z.enum(["open", "resolved"]);
const NonEmptyStringSchema = z.string().trim().min(1);
const ServiceIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const ServiceSchema = z
  .object({
    id: ServiceIdSchema,
    name: NonEmptyStringSchema,
    createdAt: z.date(),
  })
  .strict();

export const AlertSchema = z
  .object({
    id: NonEmptyStringSchema,
    serviceId: NonEmptyStringSchema,
    title: NonEmptyStringSchema,
    status: AlertStatusSchema,
    severity: SeveritySchema,
    triggeredAt: z.date(),
    resolvedAt: z.date().nullable(),
  })
  .strict()
  .superRefine((alert, context) => {
    if (alert.status === "resolved" && alert.resolvedAt === null) {
      context.addIssue({
        code: "custom",
        message: "resolved alerts require resolvedAt",
        path: ["resolvedAt"],
      });
    }
    if (alert.status === "firing" && alert.resolvedAt !== null) {
      context.addIssue({
        code: "custom",
        message: "firing alerts must have resolvedAt set to null",
        path: ["resolvedAt"],
      });
    }
  });

export const IncidentSchema = z
  .object({
    id: z.uuid(),
    title: NonEmptyStringSchema,
    serviceId: NonEmptyStringSchema,
    severity: SeveritySchema,
    status: IncidentStatusSchema,
    createdAt: z.date(),
    resolvedAt: z.date().nullable(),
  })
  .strict()
  .superRefine((incident, context) => {
    if (incident.status === "open" && incident.resolvedAt !== null) {
      context.addIssue({
        code: "custom",
        message: "open incidents must have resolvedAt set to null",
        path: ["resolvedAt"],
      });
    }
    if (incident.status === "resolved" && incident.resolvedAt === null) {
      context.addIssue({
        code: "custom",
        message: "resolved incidents require resolvedAt",
        path: ["resolvedAt"],
      });
    }
  });

export const CreateIncidentSchema = z
  .object({
    title: NonEmptyStringSchema,
    serviceId: NonEmptyStringSchema,
    severity: SeveritySchema,
  })
  .strict();

export type Service = z.infer<typeof ServiceSchema>;
export type Alert = z.infer<typeof AlertSchema>;
export type AlertStatus = z.infer<typeof AlertStatusSchema>;
export type Severity = z.infer<typeof SeveritySchema>;
export type Incident = z.infer<typeof IncidentSchema>;
export type CreateIncident = z.infer<typeof CreateIncidentSchema>;
