import test from "node:test";
import assert from "node:assert/strict";
import { MemoryOperationsStore } from "./memory-store.js";

test("memory store loads the seed data and filters alerts", async () => {
  const store = new MemoryOperationsStore();
  assert.equal((await store.listServices()).length, 5);
  assert.equal((await store.listAlerts("firing")).length, 3);
  assert.equal((await store.listAlerts("resolved")).length, 3);
});

test("memory store persists incident changes through its callback", async () => {
  const persistedStatuses: Array<string | undefined> = [];
  const store = new MemoryOperationsStore({
    clock: () => new Date("2026-11-22T10:00:00.000Z"),
    createId: () => "00000000-0000-4000-8000-000000000022",
    persist: async (data) => {
      persistedStatuses.push(data.incidents[0]?.status);
    },
  });
  const incident = await store.createIncident({
    title: "API degradation",
    serviceId: "payment-api",
    severity: "high",
  });
  assert.equal(incident.status, "open");
  assert.equal(incident.resolvedAt, null);
  const resolved = await store.resolveIncident(incident.id);
  assert.equal(resolved.status, "resolved");
  assert.deepEqual(resolved.resolvedAt, new Date("2026-11-22T10:00:00.000Z"));
  assert.deepEqual(persistedStatuses, ["open", "resolved"]);
});
