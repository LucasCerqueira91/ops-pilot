import {
  AlertSchema,
  CreateIncidentSchema,
  IncidentSchema,
  ServiceSchema,
  type Alert,
  type AlertStatus,
  type CreateIncident,
  type Incident,
  type Service,
} from "../models/domain.js";
import {
  InvalidStateError,
  NotFoundError,
} from "../services/domain-errors.js";
import type { OperationsStore } from "./operations-store.js";
import {
  createSeedData,
  type OperationsData,
} from "./seed-data.js";

export interface MemoryStoreOptions {
  clock?: () => Date;
  createId?: () => string;
  data?: OperationsData;
  persist?: (data: OperationsData) => Promise<void>;
}

export class MemoryOperationsStore implements OperationsStore {
  private readonly services = new Map<string, Service>();
  private readonly alerts = new Map<string, Alert>();
  private readonly incidents = new Map<string, Incident>();
  private readonly clock: () => Date;
  private readonly createId: () => string;
  private readonly persist?: (data: OperationsData) => Promise<void>;

  constructor(options: MemoryStoreOptions = {}) {
    this.clock = options.clock ?? (() => new Date());
    this.createId = options.createId ?? (() => crypto.randomUUID());
    this.persist = options.persist;
    const seed = options.data ?? {
      ...createSeedData(),
      incidents: [],
    };
    for (const service of seed.services) {
      this.services.set(service.id, copyService(service));
    }
    for (const alert of seed.alerts) {
      this.alerts.set(alert.id, copyAlert(alert));
    }
    for (const incident of seed.incidents) {
      this.incidents.set(incident.id, copyIncident(incident));
    }
  }

  async listServices(): Promise<Service[]> {
    return [...this.services.values()].map(copyService);
  }

  async getService(id: string): Promise<Service> {
    const service = this.services.get(id);
    if (!service) throw new NotFoundError(`Service "${id}" was not found`);
    return copyService(service);
  }

  async listAlerts(status: AlertStatus | "all" = "all"): Promise<Alert[]> {
    return [...this.alerts.values()]
      .filter((alert) => status === "all" || alert.status === status)
      .map(copyAlert);
  }

  async listIncidents(): Promise<Incident[]> {
    return [...this.incidents.values()].map(copyIncident);
  }

  async createIncident(input: CreateIncident): Promise<Incident> {
    const validInput = CreateIncidentSchema.parse(input);
    await this.getService(validInput.serviceId);
    const incident = IncidentSchema.parse({
      ...validInput,
      id: this.createId(),
      status: "open",
      createdAt: this.clock(),
      resolvedAt: null,
    });
    await this.persistSnapshot({ incidents: [...this.incidents.values(), incident] });
    this.incidents.set(incident.id, incident);
    return copyIncident(incident);
  }

  async resolveIncident(id: string): Promise<Incident> {
    const incident = this.incidents.get(id);
    if (!incident) throw new NotFoundError(`Incident "${id}" was not found`);
    if (incident.status !== "open") {
      throw new InvalidStateError(`Incident "${id}" is already resolved`);
    }
    const resolved = IncidentSchema.parse({
      ...incident,
      status: "resolved",
      resolvedAt: this.clock(),
    });
    await this.persistSnapshot({
      incidents: [...this.incidents.values()].map((item) =>
        item.id === id ? resolved : item,
      ),
    });
    this.incidents.set(id, resolved);
    return copyIncident(resolved);
  }

  async upsertService(service: Service): Promise<void> {
    const validService = ServiceSchema.parse(service);
    await this.persistSnapshot({
      services: [...this.services.values()].filter(
        (item) => item.id !== validService.id,
      ).concat(validService),
    });
    this.services.set(validService.id, copyService(validService));
  }

  async upsertAlert(alert: Alert): Promise<void> {
    const validAlert = AlertSchema.parse(alert);
    await this.getService(validAlert.serviceId);
    await this.persistSnapshot({
      alerts: [...this.alerts.values()].filter(
        (item) => item.id !== validAlert.id,
      ).concat(validAlert),
    });
    this.alerts.set(validAlert.id, copyAlert(validAlert));
  }

  async upsertFixtures(data: { services: Service[]; alerts: Alert[] }): Promise<void> {
    const services = data.services.map((service) => ServiceSchema.parse(service));
    const alerts = data.alerts.map((alert) => AlertSchema.parse(alert));
    const serviceIds = new Set([
      ...this.services.keys(),
      ...services.map((service) => service.id),
    ]);
    for (const alert of alerts) {
      if (!serviceIds.has(alert.serviceId)) {
        throw new NotFoundError(`Service "${alert.serviceId}" was not found`);
      }
    }

    await this.persistSnapshot({
      services: mergeById(this.services, services),
      alerts: mergeById(this.alerts, alerts),
    });
    for (const service of services) this.services.set(service.id, copyService(service));
    for (const alert of alerts) this.alerts.set(alert.id, copyAlert(alert));
  }

  private async persistSnapshot(
    changes: Partial<OperationsData>,
  ): Promise<void> {
    if (!this.persist) return;
    await this.persist({
      services: (changes.services ?? [...this.services.values()]).map(copyService),
      alerts: (changes.alerts ?? [...this.alerts.values()]).map(copyAlert),
      incidents: (changes.incidents ?? [...this.incidents.values()]).map(
        copyIncident,
      ),
    });
  }
}

function mergeById<T extends { id: string }>(
  current: Map<string, T>,
  incoming: T[],
): T[] {
  const merged = new Map(current);
  for (const item of incoming) merged.set(item.id, item);
  return [...merged.values()];
}

function copyService(service: Service): Service {
  return { ...service, createdAt: new Date(service.createdAt) };
}

function copyAlert(alert: Alert): Alert {
  return {
    ...alert,
    triggeredAt: new Date(alert.triggeredAt),
    resolvedAt: alert.resolvedAt ? new Date(alert.resolvedAt) : null,
  };
}

function copyIncident(incident: Incident): Incident {
  return {
    ...incident,
    createdAt: new Date(incident.createdAt),
    resolvedAt: incident.resolvedAt ? new Date(incident.resolvedAt) : null,
  };
}
