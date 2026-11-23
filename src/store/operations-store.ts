import type { Alert, Incident, Service } from "../models/domain.js";

export interface OperationsStore {
  listServices(): Service[];
  listAlerts(status: "firing" | "resolved"): Alert[];
  openIncident(input: { title: string; serviceId: string; severity: Alert["severity"] }): Incident;
  resolveIncident(id: string): Incident;
}
