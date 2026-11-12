import {
  CreateIncidentSchema,
  type AlertStatus,
  type CreateIncident,
} from "../models/domain.js";
import { ValidationError } from "./domain-errors.js";
import type { OperationsStore } from "../store/operations-store.js";

export class OperationsService {
  constructor(private readonly store: OperationsStore) {}

  async listAlerts(status: AlertStatus | "all" = "firing") {
    return this.store.listAlerts(status);
  }

  async openIncident(input: CreateIncident) {
    const parsed = CreateIncidentSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid incident input");
    }
    return this.store.createIncident(parsed.data);
  }

  async resolveIncident(id: string) {
    const parsedId = id.trim();
    if (!parsedId) throw new ValidationError("Incident id is required");
    return this.store.resolveIncident(parsedId);
  }
}
