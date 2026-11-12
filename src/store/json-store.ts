import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  Alert,
  AlertStatus,
  CreateIncident,
  Incident,
  Service,
} from "../models/domain.js";
import {
  MemoryOperationsStore,
  type MemoryStoreOptions,
} from "./memory-store.js";
import type { OperationsStore } from "./operations-store.js";
import {
  DEFAULT_JSON_DATABASE_PATH,
  parseOperationsDataJson,
  readOperationsData,
  type OperationsData,
} from "./seed-data.js";

type JsonStoreOptions = Pick<MemoryStoreOptions, "clock" | "createId">;

export class JsonOperationsStore implements OperationsStore {
  private constructor(
    private readonly store: MemoryOperationsStore,
    readonly filePath: string,
  ) {}

  static async open(
    filePath = DEFAULT_JSON_DATABASE_PATH,
    options: JsonStoreOptions = {},
  ): Promise<JsonOperationsStore> {
    let data: OperationsData;
    try {
      data = await readOperationsDataAsync(filePath);
    } catch (error) {
      if (!isMissingFile(error)) throw error;
      data = {
        ...readOperationsData(DEFAULT_JSON_DATABASE_PATH),
        incidents: [],
      };
      await writeDatabase(filePath, data);
    }

    let writeQueue = Promise.resolve();
    const store = new MemoryOperationsStore({
      ...options,
      data,
      persist: (updated) => {
        const write = writeQueue.then(() => writeDatabase(filePath, updated));
        writeQueue = write;
        return write;
      },
    });
    return new JsonOperationsStore(store, filePath);
  }

  listServices(): Promise<Service[]> {
    return this.store.listServices();
  }

  getService(id: string): Promise<Service> {
    return this.store.getService(id);
  }

  listAlerts(status?: AlertStatus | "all"): Promise<Alert[]> {
    return this.store.listAlerts(status);
  }

  listIncidents(): Promise<Incident[]> {
    return this.store.listIncidents();
  }

  createIncident(input: CreateIncident): Promise<Incident> {
    return this.store.createIncident(input);
  }

  resolveIncident(id: string): Promise<Incident> {
    return this.store.resolveIncident(id);
  }

  upsertService(service: Service): Promise<void> {
    return this.store.upsertService(service);
  }

  upsertAlert(alert: Alert): Promise<void> {
    return this.store.upsertAlert(alert);
  }

  upsertFixtures(data: { services: Service[]; alerts: Alert[] }): Promise<void> {
    return this.store.upsertFixtures(data);
  }
}

async function readOperationsDataAsync(filePath: string): Promise<OperationsData> {
  const contents = await readFile(filePath, "utf8");
  return parseOperationsDataJson(JSON.parse(contents));
}

async function writeDatabase(
  filePath: string,
  data: OperationsData,
): Promise<void> {
  const directory = dirname(filePath);
  await mkdir(directory, { recursive: true });
  const temporaryFile = `${filePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryFile, `${JSON.stringify(data, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporaryFile, filePath);
  } finally {
    await rm(temporaryFile, { force: true });
  }
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
