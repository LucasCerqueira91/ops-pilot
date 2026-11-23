import type { OperationsStore } from "../store/operations-store.js";

export class OperationsService {
  constructor(private readonly store: OperationsStore) {}
  listAlerts(status: "firing" | "resolved") { return this.store.listAlerts(status); }
  openIncident(input: { title: string; service: string; severity: "low" | "medium" | "high" | "critical" }) {
    return this.store.openIncident({ title: input.title, serviceId: input.service, severity: input.severity });
  }
  resolveIncident(id: string) { return this.store.resolveIncident(id); }
}
