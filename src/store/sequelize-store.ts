import {
  type Model,
  type Sequelize,
  type Transaction,
} from "sequelize";
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
import type { OperationsModels } from "../models/index.js";
import {
  InvalidStateError,
  NotFoundError,
} from "../services/domain-errors.js";
import type { OperationsStore } from "./operations-store.js";

export class SequelizeOperationsStore implements OperationsStore {
  constructor(
    private readonly sequelize: TransactionRunner,
    private readonly models: OperationsModels,
  ) {}

  async listServices(): Promise<Service[]> {
    const records = await this.models.Service.findAll();
    return records.map((record) => ServiceSchema.parse(record.get({ plain: true })));
  }

  async getService(id: string): Promise<Service> {
    const record = await this.models.Service.findByPk(id);
    if (!record) throw new NotFoundError(`Service "${id}" was not found`);
    return ServiceSchema.parse(record.get({ plain: true }));
  }

  async listAlerts(status: AlertStatus | "all" = "all"): Promise<Alert[]> {
    const records = await this.models.Alert.findAll({
      ...(status === "all" ? {} : { where: { status } }),
    });
    return records.map((record) => AlertSchema.parse(record.get({ plain: true })));
  }

  async listIncidents(): Promise<Incident[]> {
    const records = await this.models.Incident.findAll();
    return records.map((record) => IncidentSchema.parse(record.get({ plain: true })));
  }

  async createIncident(input: CreateIncident): Promise<Incident> {
    const parsedInput = CreateIncidentSchema.parse(input);
    return this.sequelize.transaction(async (transaction) => {
      const service = await this.models.Service.findByPk(parsedInput.serviceId, {
        transaction,
      });
      if (!service) {
        throw new NotFoundError(`Service "${parsedInput.serviceId}" was not found`);
      }
      const record = await this.models.Incident.create(
        {
          ...parsedInput,
          id: crypto.randomUUID(),
          status: "open",
          createdAt: new Date(),
          resolvedAt: null,
        },
        { transaction },
      );
      return IncidentSchema.parse(record.get({ plain: true }));
    });
  }

  async resolveIncident(id: string): Promise<Incident> {
    return this.sequelize.transaction(async (transaction) => {
      const record = await this.models.Incident.findByPk(id, { transaction });
      if (!record) throw new NotFoundError(`Incident "${id}" was not found`);
      const current = IncidentSchema.parse(record.get({ plain: true }));
      if (current.status !== "open") {
        throw new InvalidStateError(`Incident "${id}" is already resolved`);
      }
      const updated = await record.update(
        { status: "resolved", resolvedAt: new Date() },
        { transaction },
      );
      return IncidentSchema.parse(updated.get({ plain: true }));
    });
  }

  async upsertService(service: Service): Promise<void> {
    const parsed = ServiceSchema.parse(service);
    await this.models.Service.upsert(parsed);
  }

  async upsertAlert(alert: Alert): Promise<void> {
    const parsed = AlertSchema.parse(alert);
    await this.getService(parsed.serviceId);
    await this.models.Alert.upsert(parsed);
  }

  async upsertFixtures(data: { services: Service[]; alerts: Alert[] }): Promise<void> {
    const services = data.services.map((service) => ServiceSchema.parse(service));
    const alerts = data.alerts.map((alert) => AlertSchema.parse(alert));
    await this.sequelize.transaction(async (transaction) => {
      for (const service of services) {
        await this.models.Service.upsert(service, { transaction });
      }
      for (const alert of alerts) {
        await this.models.Alert.upsert(alert, { transaction });
      }
    });
  }
}

export interface TransactionRunner {
  transaction<T>(
    callback: (transaction: Transaction) => Promise<T>,
  ): Promise<T>;
}
