import { DataTypes, Model, type ModelStatic, type Sequelize } from "sequelize";

export function defineAlertModel(sequelize: Sequelize): ModelStatic<Model> {
  return sequelize.define(
    "Alert",
    {
      id: { type: DataTypes.STRING(120), primaryKey: true, allowNull: false },
      serviceId: {
        type: DataTypes.STRING(120),
        allowNull: false,
        references: { model: "services", key: "id" },
      },
      title: { type: DataTypes.STRING(255), allowNull: false },
      status: {
        type: DataTypes.ENUM("firing", "resolved"),
        allowNull: false,
      },
      severity: {
        type: DataTypes.ENUM("low", "medium", "high", "critical"),
        allowNull: false,
      },
      triggeredAt: { type: DataTypes.DATE, allowNull: false },
      resolvedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: "alerts", timestamps: false },
  );
}
