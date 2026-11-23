import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { AlertSchema, IncidentSchema, ServiceSchema, type Alert, type Incident, type Service } from "../models/domain.js";
import { InvalidStateError, NotFoundError, ValidationError } from "../services/domain-errors.js";
import type { OperationsStore } from "./operations-store.js";

export interface SeedFixture { services: Service[]; alerts: Alert[]; incidents: Incident[] }

export class MemoryOperationsStore implements OperationsStore {
  private services: Service[];
  private alerts: Alert[];
  private incidents: Incident[];

  constructor(private readonly persistencePath?: string, private readonly clock: () => Date = () => new Date()) {
    const seed = this.loadSeed();
    this.services = seed.services.map((item) => ({ ...item }));
    this.alerts = seed.alerts.map((item) => ({ ...item }));
    this.incidents = seed.incidents.map((item) => ({ ...item }));
  }

  private loadSeed(): SeedFixture {
    const path = this.persistencePath ?? resolve(process.cwd(), "src/store/seed-data.json");
    if (!existsSync(path)) throw new Error(`Seed JSON not found: ${path}`);
    const parsed = JSON.parse(readFileSync(path, "utf8")) as SeedFixture;
    return {
      services: parsed.services.map((item) => ServiceSchema.parse(item)),
      alerts: parsed.alerts.map((item) => AlertSchema.parse(item)),
      incidents: parsed.incidents.map((item) => IncidentSchema.parse(item)),
    };
  }

  private persist(): void {
    if (!this.persistencePath) return;
    writeFileSync(this.persistencePath, JSON.stringify({ services: this.services, alerts: this.alerts, incidents: this.incidents }, null, 2), "utf8");
  }

  listServices(): Service[] { return this.services.map((item) => ({ ...item })); }
  listAlerts(status: "firing" | "resolved"): Alert[] { return this.alerts.filter((item) => item.status === status).map((item) => ({ ...item })); }

  openIncident(input: { title: string; serviceId: string; severity: Alert["severity"] }): Incident {
    if (!input.title?.trim()) throw new ValidationError("Incident title is required");
    if (!this.services.some((item) => item.id === input.serviceId)) throw new NotFoundError(`Unknown service: ${input.serviceId}`);
    const now = this.clock().toISOString();
    const incident = IncidentSchema.parse({ id: randomUUID(), title: input.title.trim(), serviceId: input.serviceId, severity: input.severity, status: "open", createdAt: now, resolvedAt: null });
    this.incidents.push(incident);
    this.persist();
    return { ...incident };
  }

  resolveIncident(id: string): Incident {
    const incident = this.incidents.find((item) => item.id === id);
    if (!incident) throw new NotFoundError(`Unknown incident: ${id}`);
    if (incident.status === "resolved") throw new InvalidStateError(`Incident ${id} is already resolved`);
    const resolved = IncidentSchema.parse({ ...incident, status: "resolved", resolvedAt: this.clock().toISOString() });
    this.incidents = this.incidents.map((item) => item.id === id ? resolved : item);
    this.persist();
    return { ...resolved };
  }
}
