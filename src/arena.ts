import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runArenaController } from "./controllers/arena-controller.js";

async function main(): Promise<void> {
  try {
    await runArenaController();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Arena failed: ${message}`);
    process.exitCode = 1;
  }
}

const entryPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : undefined;

if (entryPath === import.meta.url) {
  await main();
}
