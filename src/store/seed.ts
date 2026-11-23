import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const seedPath = resolve(process.cwd(), "src/store/seed-data.json");
const runtimePath = resolve(process.cwd(), "src/store/runtime-state.json");
if (!existsSync(seedPath)) throw new Error(`Seed JSON not found: ${seedPath}`);

const seed = JSON.parse(readFileSync(seedPath, "utf8"));
const counts = { services: seed.services.length, firing: seed.alerts.filter((a: { status: string }) => a.status === "firing").length, resolved: seed.alerts.filter((a: { status: string }) => a.status === "resolved").length };
writeFileSync(seedPath, JSON.stringify(seed, null, 2) + "\n", "utf8");
writeFileSync(runtimePath, JSON.stringify(seed, null, 2) + "\n", "utf8");
console.log(`Seed JSON ready: ${counts.services} services, ${counts.firing + counts.resolved} alerts (${counts.firing} firing, ${counts.resolved} resolved). Runtime state reset.`);
