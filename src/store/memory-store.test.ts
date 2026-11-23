import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { MemoryOperationsStore } from "./memory-store.js";

const fixturePath = resolve(process.cwd(), "src/store/seed-data.json");
const runtimePath = resolve(process.cwd(), "src/store/runtime-state.json");

test("memory store loads the JSON fixture and exposes three firing alerts", () => {
  const store = new MemoryOperationsStore(fixturePath);
  assert.equal(store.listServices().length, 5);
  assert.equal(store.listAlerts("firing").length, 3);
  assert.equal(store.listAlerts("resolved").length, 3);
});

test("memory store creates and resolves incidents in the runtime JSON", () => {
  const fixture = readFileSync(fixturePath, "utf8");
  writeFileSync(runtimePath, fixture, "utf8");
  const store = new MemoryOperationsStore(runtimePath, () => new Date("2026-11-22T10:00:00.000Z"));
  const incident = store.openIncident({ title: "API degradation", serviceId: "auth", severity: "high" });
  assert.equal(incident.status, "open");
  assert.equal(incident.resolvedAt, null);
  const resolved = store.resolveIncident(incident.id);
  assert.equal(resolved.status, "resolved");
  assert.equal(resolved.resolvedAt, "2026-11-22T10:00:00.000Z");
  writeFileSync(runtimePath, fixture, "utf8");
});
