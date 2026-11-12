import { DataTypes, Model, type ModelStatic, type Sequelize } from "sequelize";

export function defineServiceModel(sequelize: Sequelize): ModelStatic<Model> {
  return sequelize.define(
    "Service",
    {
      id: { type: DataTypes.STRING(120), primaryKey: true, allowNull: false },
      name: { type: DataTypes.STRING(255), allowNull: false },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    { tableName: "services", timestamps: false },
  );
}
