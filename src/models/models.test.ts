import assert from "node:assert/strict";
import test from "node:test";
import { Sequelize } from "sequelize";
import { initializeModels } from "./index.js";

test("Sequelize metadata declares domain fields, enums, keys, and associations", () => {
  const sequelize = new Sequelize({
    dialect: "mysql",
    database: "ops_pilot_test",
    username: "test",
    password: "test",
    logging: false,
    dialectModule: {},
  });
  const models = initializeModels(sequelize);

  assert.equal(models.Service.rawAttributes.id.primaryKey, true);
  assert.equal(models.Service.rawAttributes.name.allowNull, false);
  assert.equal(models.Alert.rawAttributes.serviceId.allowNull, false);
  assert.equal(models.Alert.rawAttributes.title.allowNull, false);
  assert.deepEqual(models.Alert.rawAttributes.status.values, [
    "firing",
    "resolved",
  ]);
  assert.deepEqual(models.Alert.rawAttributes.severity.values, [
    "low",
    "medium",
    "high",
    "critical",
  ]);
  assert.equal(models.Alert.rawAttributes.triggeredAt.allowNull, false);
  assert.equal(models.Alert.rawAttributes.resolvedAt.allowNull, true);
  assert.deepEqual(models.Incident.rawAttributes.status.values, [
    "open",
    "resolved",
  ]);
  assert.deepEqual(models.Incident.rawAttributes.severity.values, [
    "low",
    "medium",
    "high",
    "critical",
  ]);
  assert.ok(models.Incident.rawAttributes.serviceId.references);
  assert.equal(models.Service.associations.alerts.target, models.Alert);
  assert.equal(models.Service.associations.incidents.target, models.Incident);
  void sequelize.close();
});
