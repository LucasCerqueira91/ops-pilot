import type { Alert, Service } from "../models/domain.js";

const createdAt = new Date("2026-01-01T00:00:00.000Z");

const services: readonly Service[] = [
  { id: "api-gateway", name: "API Gateway", createdAt },
  { id: "payments", name: "Payments", createdAt },
  { id: "identity", name: "Identity", createdAt },
  { id: "notifications", name: "Notifications", createdAt },
  { id: "catalog", name: "Catalog", createdAt },
];

const alerts: readonly Alert[] = [
  {
    id: "seed-alert-api-latency",
    serviceId: "api-gateway",
    title: "Elevated API latency",
    status: "firing",
    severity: "high",
    triggeredAt: new Date("2026-01-01T01:00:00.000Z"),
    resolvedAt: null,
  },
  {
    id: "seed-alert-payment-errors",
    serviceId: "payments",
    title: "Payment error rate above threshold",
    status: "firing",
    severity: "critical",
    triggeredAt: new Date("2026-01-01T02:00:00.000Z"),
    resolvedAt: null,
  },
  {
    id: "seed-alert-identity-timeout",
    serviceId: "identity",
    title: "Identity provider timeout",
    status: "firing",
    severity: "medium",
    triggeredAt: new Date("2026-01-01T03:00:00.000Z"),
    resolvedAt: null,
  },
  {
    id: "seed-alert-notification-queue",
    serviceId: "notifications",
    title: "Notification queue backlog",
    status: "resolved",
    severity: "medium",
    triggeredAt: new Date("2025-12-31T23:00:00.000Z"),
    resolvedAt: new Date("2026-01-01T00:30:00.000Z"),
  },
  {
    id: "seed-alert-catalog-cache",
    serviceId: "catalog",
    title: "Catalog cache miss spike",
    status: "resolved",
    severity: "low",
    triggeredAt: new Date("2025-12-31T22:00:00.000Z"),
    resolvedAt: new Date("2026-01-01T00:45:00.000Z"),
  },
  {
    id: "seed-alert-api-retries",
    serviceId: "api-gateway",
    title: "Upstream retry saturation",
    status: "resolved",
    severity: "high",
    triggeredAt: new Date("2025-12-31T21:00:00.000Z"),
    resolvedAt: new Date("2026-01-01T01:15:00.000Z"),
  },
];

export function createSeedData(): { services: Service[]; alerts: Alert[] } {
  return {
    services: services.map((service) => ({
      ...service,
      createdAt: new Date(service.createdAt),
    })),
    alerts: alerts.map((alert) => ({
      ...alert,
      triggeredAt: new Date(alert.triggeredAt),
      resolvedAt: alert.resolvedAt ? new Date(alert.resolvedAt) : null,
    })),
  };
}
