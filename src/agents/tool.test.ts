import assert from "node:assert/strict";
import test from "node:test";
import { MemoryOperationsStore } from "../store/memory-store.js";
import { createOpsTools } from "./tool.js";

test("tool schemas validate inputs before delegating to the store", async () => {
  const store = new MemoryOperationsStore({
    createId: () => "00000000-0000-4000-8000-000000000002",
  });
  const tools = createOpsTools(store);

  assert.equal(tools.list_alerts.name, "list_alerts");
  assert.equal(tools.open_incident.name, "open_incident");
  assert.equal(tools.resolve_incident.name, "resolve_incident");
  await assert.rejects(
    tools.open_incident.invoke({
      title: "",
      service: "payment-api",
      severity: "high",
    }),
  );
  await assert.rejects(
    tools.open_incident.invoke({
      title: "Valid title",
      service: "unknown-service",
      severity: "high",
    }),
    /service/i,
  );
  assert.equal((await store.listIncidents()).length, 0);
});

test("alert output is readable and incident tools return delegated results", async () => {
  const store = new MemoryOperationsStore({
    createId: () => "00000000-0000-4000-8000-000000000003",
    clock: () => new Date("2026-02-01T00:00:00.000Z"),
  });
  const tools = createOpsTools(store);
  const alerts = await tools.list_alerts.invoke({ status: "firing" });
  const created = JSON.parse(
    await tools.open_incident.invoke({
      title: "Database unavailable",
      service: "payment-api",
      severity: "critical",
    }),
  ) as { id: string; status: string; createdAt: string };
  const resolved = JSON.parse(
    await tools.resolve_incident.invoke({ id: created.id }),
  ) as { id: string; status: string; resolvedAt: string };

  assert.match(alerts, /^Found 3 firing alert\(s\):/);
  assert.match(
    alerts,
    /\[alert-001\] payment-api \| critical \| High error rate on \/checkout/,
  );
  assert.match(
    alerts,
    /\[alert-003\] order-service \| critical \| DB connection pool exhausted/,
  );
  assert.equal(created.status, "open");
  assert.equal(resolved.id, created.id);
  assert.equal(resolved.status, "resolved");
  assert.ok(Date.parse(resolved.resolvedAt) > 0);
});
