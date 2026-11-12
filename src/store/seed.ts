import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { OperationsStore } from "./operations-store.js";
import {
  createSeedData,
  DEFAULT_JSON_DATABASE_PATH,
} from "./seed-data.js";
import { JsonOperationsStore } from "./json-store.js";

export async function seedOperationsStore(store: OperationsStore): Promise<void> {
  await store.upsertFixtures(createSeedData());
}

export async function initializeJsonDatabase(
  filePath = DEFAULT_JSON_DATABASE_PATH,
): Promise<{ services: number; alerts: number; incidents: number }> {
  const store = await JsonOperationsStore.open(filePath);
  const [services, alerts, incidents] = await Promise.all([
    store.listServices(),
    store.listAlerts("all"),
    store.listIncidents(),
  ]);
  return {
    services: services.length,
    alerts: alerts.length,
    incidents: incidents.length,
  };
}

export async function runSeedCommand(): Promise<void> {
  try {
    const counts = await initializeJsonDatabase();
    console.log(
      `JSON database ready: ${counts.services} services, ${counts.alerts} alerts, ${counts.incidents} incidents. Existing data was preserved.`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Seed failed: ${message}`);
    process.exitCode = 1;
  }
}

const entryPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : undefined;

if (entryPath === import.meta.url) {
  await runSeedCommand();
}
