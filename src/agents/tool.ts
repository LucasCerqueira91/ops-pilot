import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { OperationsService } from "../services/operations.js";

export const listAlertsInputSchema = z.object({ status: z.enum(["firing", "resolved"]) });
export const openIncidentInputSchema = z.object({ title: z.string().trim().min(1), service: z.string().trim().min(1), severity: z.enum(["low", "medium", "high", "critical"])});
export const resolveIncidentInputSchema = z.object({ id: z.string().trim().min(1) });

export function createOperationsTools(operations: OperationsService) {
  return [
    tool(async (input: z.infer<typeof listAlertsInputSchema>) => operations.listAlerts(input.status), {
      name: "list_alerts", description: "List firing or resolved alerts", schema: listAlertsInputSchema,
    }),
    tool(async (input: z.infer<typeof openIncidentInputSchema>) => operations.openIncident(input), {
      name: "open_incident", description: "Open an incident for an existing service", schema: openIncidentInputSchema,
    }),
    tool(async (input: z.infer<typeof resolveIncidentInputSchema>) => operations.resolveIncident(input.id), {
      name: "resolve_incident", description: "Resolve an existing open incident", schema: resolveIncidentInputSchema,
    }),
  ];
}
