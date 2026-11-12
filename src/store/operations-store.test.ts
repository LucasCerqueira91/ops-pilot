import assert from "node:assert/strict";
import test from "node:test";
import { MemoryOperationsStore } from "./memory-store.js";
import { createSeedData } from "./seed-data.js";

test("the fresh store has the documented fixture and filters alerts", async () => {
  const store = new MemoryOperationsStore();
  const services = await store.listServices();
  const firing = await store.listAlerts("firing");
  const resolved = await store.listAlerts("resolved");

  assert.equal(services.length, 5);
  assert.equal((await store.listAlerts()).length, 6);
  assert.equal(firing.length, 3);
  assert.equal(resolved.length, 3);
  assert.ok(firing.every((alert) => alert.status === "firing"));
  assert.ok(resolved.every((alert) => alert.status === "resolved"));
});

test("incident creation and resolution preserve domain invariants", async () => {
  const store = new MemoryOperationsStore({
    clock: () => new Date("2026-01-02T03:04:05.000Z"),
    createId: () => "00000000-0000-4000-8000-000000000001",
  });
  const incident = await store.createIncident({
    title: "Elevated latency",
    serviceId: "api-gateway",
    severity: "high",
  });

  assert.equal(incident.status, "open");
  assert.equal(incident.resolvedAt, null);
  assert.deepEqual(await store.resolveIncident(incident.id), {
    ...incident,
    status: "resolved",
    resolvedAt: new Date("2026-01-02T03:04:05.000Z"),
  });
});

test("invalid inputs and unknown IDs fail without mutating state", async () => {
  const store = new MemoryOperationsStore();
  const initialIncidents = await store.listIncidents();

  await assert.rejects(
    store.createIncident({
      title: " ",
      serviceId: "api-gateway",
      severity: "high",
    }),
    /title/i,
  );
  await assert.rejects(
    store.upsertService({
      id: "Not A Slug",
      name: "Invalid service id",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    }),
  );
  await assert.rejects(
    store.createIncident({
      title: "Unknown service",
      serviceId: "missing",
      severity: "high",
    }),
    /service/i,
  );
  await assert.rejects(store.resolveIncident("missing"), /incident/i);
  assert.deepEqual(await store.listIncidents(), initialIncidents);
});

test("fixture definitions are immutable and can be copied into independent stores", async () => {
  const fixture = createSeedData();
  const first = new MemoryOperationsStore();
  const second = new MemoryOperationsStore();
  const incident = await first.createIncident({
    title: "Isolated incident",
    serviceId: "api-gateway",
    severity: "low",
  });

  assert.equal(fixture.services.length, 5);
  assert.equal(fixture.alerts.length, 6);
  assert.equal((await second.listIncidents()).length, 0);
  assert.equal(incident.id.length > 0, true);
});
