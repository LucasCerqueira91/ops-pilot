import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { OperationsStore } from "./operations-store.js";
import { createSeedData } from "./seed-data.js";
import { createDatabase } from "./database.js";
import { SequelizeOperationsStore } from "./sequelize-store.js";

export async function seedOperationsStore(store: OperationsStore): Promise<void> {
  await store.upsertFixtures(createSeedData());
}

export async function withDatabaseConnection<
  Connection extends { sequelize: { close(): Promise<void> } },
  Result,
>(
  connection: Connection,
  operation: (connection: Connection) => Promise<Result>,
): Promise<Result> {
  try {
    return await operation(connection);
  } finally {
    await connection.sequelize.close();
  }
}

export async function runSeedCommand(): Promise<void> {
  try {
    const connection = createDatabase();
    await withDatabaseConnection(connection, async ({ sequelize, models }) => {
      await sequelize.sync();
      const store = new SequelizeOperationsStore(sequelize, models);
      await seedOperationsStore(store);
      const services = await store.listServices();
      const alerts = await store.listAlerts();
      console.log(
        `Seed completed: ${services.length} services, ${alerts.length} alerts.`,
      );
    });
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
