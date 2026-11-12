import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  AlertSchema,
  IncidentSchema,
  ServiceSchema,
  type Alert,
  type Incident,
  type Service,
} from "../models/domain.js";

export interface OperationsData {
  services: Service[];
  alerts: Alert[];
  incidents: Incident[];
}

export const DEFAULT_JSON_DATABASE_PATH = fileURLToPath(
  new URL("./seed-data.json", import.meta.url),
);

const JsonDatabaseSchema = z
  .object({
    services: z.array(
      z
        .object({
          id: z.string(),
          name: z.string(),
          createdAt: z.coerce.date(),
        })
        .strict(),
    ),
    alerts: z.array(
      z
        .object({
          id: z.string(),
          serviceId: z.string(),
          title: z.string(),
          status: z.enum(["firing", "resolved"]),
          severity: z.enum(["low", "medium", "high", "critical"]),
          triggeredAt: z.coerce.date(),
          resolvedAt: z.coerce.date().nullable(),
        })
        .strict(),
    ),
    incidents: z.array(
      z
        .object({
          id: z.string(),
          title: z.string(),
          serviceId: z.string(),
          severity: z.enum(["low", "medium", "high", "critical"]),
          status: z.enum(["open", "resolved"]),
          createdAt: z.coerce.date(),
          resolvedAt: z.coerce.date().nullable(),
        })
        .strict(),
    ),
  })
  .strict();

export function readOperationsData(
  filePath = DEFAULT_JSON_DATABASE_PATH,
): OperationsData {
  return parseOperationsDataJson(JSON.parse(readFileSync(filePath, "utf8")));
}

export function parseOperationsDataJson(value: unknown): OperationsData {
  const parsed = JsonDatabaseSchema.parse(value);
  const services = parsed.services.map((service) =>
    ServiceSchema.parse(service),
  );
  const alerts = parsed.alerts.map((alert) => AlertSchema.parse(alert));
  const incidents = parsed.incidents.map((incident) =>
    IncidentSchema.parse(incident),
  );
  const serviceIds = new Set(services.map((service) => service.id));
  assertUniqueIds("service", services);
  assertUniqueIds("alert", alerts);
  assertUniqueIds("incident", incidents);

  for (const record of [...alerts, ...incidents]) {
    if (!serviceIds.has(record.serviceId)) {
      throw new Error(
        `JSON database references unknown service "${record.serviceId}"`,
      );
    }
  }

  return { services, alerts, incidents };
}

function assertUniqueIds(recordsType: string, records: { id: string }[]): void {
  const seen = new Set<string>();
  for (const record of records) {
    if (seen.has(record.id)) {
      throw new Error(
        `JSON database contains duplicate ${recordsType} id "${record.id}"`,
      );
    }
    seen.add(record.id);
  }
}

export function createSeedData(): { services: Service[]; alerts: Alert[] } {
  const data = readOperationsData();
  return {
    services: data.services.map((service) => ({
      ...service,
      createdAt: new Date(service.createdAt),
    })),
    alerts: data.alerts.map((alert) => ({
      ...alert,
      triggeredAt: new Date(alert.triggeredAt),
      resolvedAt: alert.resolvedAt ? new Date(alert.resolvedAt) : null,
    })),
  };
}
