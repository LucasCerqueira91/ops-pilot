import assert from "node:assert/strict";
import test from "node:test";
import type { Transaction } from "sequelize";
import {
  SequelizeOperationsStore,
  type TransactionRunner,
} from "./sequelize-store.js";

test("adapter filters persisted alerts and rolls back failed transactions", async () => {
  let transactionFinished = false;
  const rows = [
    {
      get: () => ({
        id: "alert-firing",
        serviceId: "api-gateway",
        title: "Elevated latency",
        status: "firing",
        severity: "high",
        triggeredAt: new Date("2026-01-01T00:00:00.000Z"),
        resolvedAt: null,
      }),
    },
  ];
  const models = {
    Service: {
      findAll: async () => [],
      findByPk: async () => ({ get: () => ({ id: "api-gateway" }) }),
      upsert: async () => undefined,
    },
    Alert: {
      findAll: async (options: { where?: { status?: string } }) =>
        rows.filter((row) => options.where?.status === "firing"),
      upsert: async () => undefined,
    },
    Incident: {
      findAll: async () => [],
      findByPk: async () => null,
      create: async () => {
        throw new Error("simulated write failure");
      },
    },
  };
  const sequelize: TransactionRunner = {
    transaction: async <T>(
      callback: (transaction: Transaction) => Promise<T>,
    ) => {
      try {
        const result = await callback({} as Transaction);
        transactionFinished = true;
        return result;
      } catch (error) {
        transactionFinished = false;
        throw error;
      }
    },
  };
  const store = new SequelizeOperationsStore(
    sequelize,
    models as never,
  );

  assert.equal((await store.listAlerts("firing")).length, 1);
  assert.equal((await store.listAlerts("resolved")).length, 0);
  await assert.rejects(
    store.createIncident({
      title: "Write failure",
      serviceId: "api-gateway",
      severity: "high",
    }),
    /simulated write failure/,
  );
  assert.equal(transactionFinished, false);
});

test("adapter creates and resolves incidents and rejects unknown IDs", async () => {
  const service = {
    get: () => ({ id: "api-gateway", name: "API Gateway", createdAt: new Date() }),
  };
  let incidentData: Record<string, unknown> | undefined;
  const incidentRecord = {
    get: () => incidentData,
    update: async (values: Record<string, unknown>) => {
      incidentData = { ...incidentData, ...values };
      return incidentRecord;
    },
  };
  const models = {
    Service: {
      findByPk: async (id: string) => (id === "api-gateway" ? service : null),
    },
    Alert: {},
    Incident: {
      create: async (values: Record<string, unknown>) => {
        incidentData = values;
        return incidentRecord;
      },
      findByPk: async (id: string) =>
        id === incidentData?.id ? incidentRecord : null,
    },
  };
  const sequelize: TransactionRunner = {
    transaction: async (callback) => callback({} as Transaction),
  };
  const store = new SequelizeOperationsStore(sequelize, models as never);

  const created = await store.createIncident({
    title: "Gateway outage",
    serviceId: "api-gateway",
    severity: "critical",
  });
  assert.equal(created.status, "open");
  assert.equal(created.resolvedAt, null);
  assert.equal((await store.resolveIncident(created.id)).status, "resolved");
  await assert.rejects(store.resolveIncident("missing"), /not found/i);
});
