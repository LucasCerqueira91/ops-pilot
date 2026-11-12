import type {
  Alert,
  AlertStatus,
  CreateIncident,
  Incident,
  Service,
} from "../models/domain.js";

export interface OperationsStore {
  listServices(): Promise<Service[]>;
  getService(id: string): Promise<Service>;
  listAlerts(status?: AlertStatus | "all"): Promise<Alert[]>;
  listIncidents(): Promise<Incident[]>;
  createIncident(input: CreateIncident): Promise<Incident>;
  resolveIncident(id: string): Promise<Incident>;
  upsertService(service: Service): Promise<void>;
  upsertAlert(alert: Alert): Promise<void>;
  upsertFixtures(data: { services: Service[]; alerts: Alert[] }): Promise<void>;
}
