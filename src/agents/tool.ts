import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { OperationsStore } from "../store/operations-store.js";
import { OperationsService } from "../services/operations.js";

export const ListAlertsInputSchema = z
  .object({
    status: z.enum(["firing", "resolved", "all"]).default("firing"),
  })
  .strict();

export const OpenIncidentInputSchema = z
  .object({
    title: z.string().trim().min(1),
    service: z.string().trim().min(1),
    severity: z.enum(["low", "medium", "high", "critical"]),
  })
  .strict();

export const ResolveIncidentInputSchema = z
  .object({
    id: z.string().trim().min(1),
  })
  .strict();

export function createOpsTools(store: OperationsStore) {
  const operations = new OperationsService(store);

  const listAlerts = tool(
    async ({ status }) => {
      const alerts = await operations.listAlerts(status);
      const rows = alerts.map(
        (alert) =>
          `- [${alert.id}] ${alert.serviceId} | ${alert.severity} | ${alert.title}`,
      );
      return `Found ${alerts.length} ${status} alert(s)${rows.length ? `:\n${rows.join("\n")}` : "."}`;
    },
    {
      name: "list_alerts",
      description:
        "Lista alertas de monitoramento por estado (firing, resolved ou all), retornando a quantidade e linhas no formato [id] serviço | severidade | título.",
      schema: ListAlertsInputSchema,
    },
  );

  const openIncident = tool(
    async ({ title, service, severity }) =>
      JSON.stringify(
        await operations.openIncident({
          title,
          serviceId: service,
          severity,
        }),
      ),
    {
      name: "open_incident",
      description: "Abre um incidente para um serviço existente.",
      schema: OpenIncidentInputSchema,
    },
  );

  const resolveIncident = tool(
    async ({ id }) =>
      JSON.stringify(await operations.resolveIncident(id)),
    {
      name: "resolve_incident",
      description: "Resolve um incidente aberto pelo identificador.",
      schema: ResolveIncidentInputSchema,
    },
  );

  return {
    list_alerts: listAlerts,
    open_incident: openIncident,
    resolve_incident: resolveIncident,
  };
}

export type OpsTools = ReturnType<typeof createOpsTools>;
