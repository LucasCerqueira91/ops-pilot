import assert from "node:assert/strict";
import test from "node:test";
import { createDatabase } from "./database.js";
import { withDatabaseConnection } from "./seed.js";

test("MySQL configuration rejects missing and invalid external values", () => {
  assert.throws(() => createDatabase({}), /MYSQL_HOST/);
  assert.throws(
    () =>
      createDatabase({
        MYSQL_HOST: "localhost",
        MYSQL_PORT: "0",
        MYSQL_DATABASE: "ops",
        MYSQL_USER: "test",
        MYSQL_PASSWORD: "test",
      }),
    /MYSQL_PORT/,
  );
});

test("database connection closes after successful and failed seed operations", async () => {
  let closeCount = 0;
  const connection = {
    sequelize: {
      close: async () => {
        closeCount += 1;
      },
    },
  };

  assert.equal(
    await withDatabaseConnection(connection, async () => "complete"),
    "complete",
  );
  await assert.rejects(
    withDatabaseConnection(connection, async () => {
      throw new Error("seed failure");
    }),
    /seed failure/,
  );
  assert.equal(closeCount, 2);
});
