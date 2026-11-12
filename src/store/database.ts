import { Sequelize } from "sequelize";
import { z } from "zod";
import { initializeModels } from "../models/index.js";

const MysqlEnvironmentSchema = z
  .object({
    MYSQL_HOST: z.string().trim().min(1),
    MYSQL_PORT: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .pipe(z.number().int().positive()),
    MYSQL_DATABASE: z.string().trim().min(1),
    MYSQL_USER: z.string().trim().min(1),
    MYSQL_PASSWORD: z.string().min(1),
  })
  .strict();

export function createDatabase(
  environment: Record<string, string | undefined> = process.env,
) {
  const config = MysqlEnvironmentSchema.parse({
    MYSQL_HOST: environment.MYSQL_HOST,
    MYSQL_PORT: environment.MYSQL_PORT,
    MYSQL_DATABASE: environment.MYSQL_DATABASE,
    MYSQL_USER: environment.MYSQL_USER,
    MYSQL_PASSWORD: environment.MYSQL_PASSWORD,
  });
  // TODO: add mysql2 through an approved registry before using the MySQL adapter.
  const sequelize = new Sequelize({
    dialect: "mysql",
    host: config.MYSQL_HOST,
    port: config.MYSQL_PORT,
    database: config.MYSQL_DATABASE,
    username: config.MYSQL_USER,
    password: config.MYSQL_PASSWORD,
    logging: false,
  });
  return { sequelize, models: initializeModels(sequelize) };
}
