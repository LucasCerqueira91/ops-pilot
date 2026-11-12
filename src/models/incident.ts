import { DataTypes, Model, type ModelStatic, type Sequelize } from "sequelize";

export function defineIncidentModel(sequelize: Sequelize): ModelStatic<Model> {
  return sequelize.define(
    "Incident",
    {
      id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
      title: { type: DataTypes.STRING(255), allowNull: false },
      serviceId: {
        type: DataTypes.STRING(120),
        allowNull: false,
        references: { model: "services", key: "id" },
      },
      severity: {
        type: DataTypes.ENUM("low", "medium", "high", "critical"),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("open", "resolved"),
        allowNull: false,
      },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      resolvedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: "incidents", timestamps: false },
  );
}
