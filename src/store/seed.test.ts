import assert from "node:assert/strict";
import test from "node:test";
import { MemoryOperationsStore } from "./memory-store.js";
import { seedOperationsStore } from "./seed.js";

test("fixture seeding is repeatable and leaves unrelated records untouched", async () => {
  const store = new MemoryOperationsStore({
    createId: () => "00000000-0000-4000-8000-000000000004",
  });
  const unrelated = await store.createIncident({
    title: "Operator-created incident",
    serviceId: "api-gateway",
    severity: "medium",
  });

  await seedOperationsStore(store);
  await seedOperationsStore(store);

  assert.equal((await store.listServices()).length, 5);
  assert.equal((await store.listAlerts()).length, 6);
  assert.equal((await store.listIncidents()).length, 1);
  assert.equal((await store.listIncidents())[0]?.id, unrelated.id);
});
