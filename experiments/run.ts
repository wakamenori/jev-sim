import { mkdirSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { createModelClients, type RunOptions, runSim } from "../src/run.ts";
import { buildWorld } from "../src/world.ts";
import { type Intervention, intervene, validateInterventions } from "./intervention.ts";

export async function runExperiment(options: RunOptions, interventions: Intervention[], base?: string) {
  validateInterventions(buildWorld(), interventions, options.until);
  const result = await runSim(options, createModelClients, (choose) => intervene(choose, interventions));
  mkdirSync("out/experiments", { recursive: true });
  writeFileSync(
    `out/experiments/${basename(result.file)}`,
    JSON.stringify({ run: result.file, base, interventions }, null, 2),
  );
  return result;
}
