import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { JsonOperationsStore } from "./json-store.js";
import { initializeJsonDatabase } from "./seed.js";
import {
  parseOperationsDataJson,
  readOperationsData,
} from "./seed-data.js";

test("JSON store initializes from seeds and persists records for the next run", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ops-pilot-json-store-"));
  const databasePath = join(directory, "ops-pilot.json");
  try {
    const store = await JsonOperationsStore.open(databasePath, {
      createId: () => "00000000-0000-4000-8000-000000000020",
      clock: () => new Date("2026-03-01T00:00:00.000Z"),
    });

    assert.equal((await store.listServices()).length, 5);
    assert.equal((await store.listAlerts()).length, 6);
    const incident = await store.createIncident({
      title: "JSON-backed incident",
      serviceId: "payment-api",
      severity: "high",
    });
    assert.deepEqual(await initializeJsonDatabase(databasePath), {
      services: 5,
      alerts: 6,
      incidents: 1,
    });
    const reloaded = await JsonOperationsStore.open(databasePath, {
      clock: () => new Date("2026-03-01T00:00:00.000Z"),
    });

    assert.equal((await reloaded.listIncidents()).length, 1);
    assert.deepEqual(await reloaded.resolveIncident(incident.id), {
      ...incident,
      status: "resolved",
      resolvedAt: new Date("2026-03-01T00:00:00.000Z"),
    });
    const saved = JSON.parse(await readFile(databasePath, "utf8")) as {
      services: unknown[];
      alerts: unknown[];
      incidents: Array<{ status: string }>;
    };
    assert.equal(saved.services.length, 5);
    assert.equal(saved.alerts.length, 6);
    assert.equal(saved.incidents[0]?.status, "resolved");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("JSON store rejects corrupt data instead of silently reseeding it", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ops-pilot-json-invalid-"));
  const databasePath = join(directory, "ops-pilot.json");
  try {
    await writeFile(databasePath, '{"services": []}', "utf8");
    await assert.rejects(JsonOperationsStore.open(databasePath));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("JSON store rejects duplicate record IDs", () => {
  const data = readOperationsData();
  const firstService = data.services[0];
  assert.ok(firstService);
  assert.throws(
    () =>
      parseOperationsDataJson({
        ...data,
        services: [...data.services, firstService],
      }),
    /duplicate service id/,
  );
});
