import type { Model, ModelStatic, Sequelize } from "sequelize";
import { defineAlertModel } from "./alert.js";
import { defineIncidentModel } from "./incident.js";
import { defineServiceModel } from "./service.js";

export interface OperationsModels {
  Service: ModelStatic<Model>;
  Alert: ModelStatic<Model>;
  Incident: ModelStatic<Model>;
}

export function initializeModels(sequelize: Sequelize): OperationsModels {
  const Service = defineServiceModel(sequelize);
  const Alert = defineAlertModel(sequelize);
  const Incident = defineIncidentModel(sequelize);
  Service.hasMany(Alert, { foreignKey: "serviceId", as: "alerts" });
  Service.hasMany(Incident, { foreignKey: "serviceId", as: "incidents" });
  Alert.belongsTo(Service, { foreignKey: "serviceId", as: "service" });
  Incident.belongsTo(Service, { foreignKey: "serviceId", as: "service" });
  return { Service, Alert, Incident };
}
