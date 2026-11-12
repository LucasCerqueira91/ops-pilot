import assert from "node:assert/strict";
import test from "node:test";
import { createDatabase } from "./database.js";

test("deferred MySQL configuration rejects missing and invalid external values", () => {
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
