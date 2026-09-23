// 干渉なしのベースライン実行。  pnpm baseline [--until N] [--verbose]
import { runSim, supportTally } from "./run.ts";

const arg = (k: string) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const until = arg("--until");
const { world } = await runSim({
  until: until ? Number(until) : undefined,
  verbose: process.argv.includes("--verbose"),
});
for (const [c, ids] of Object.entries(supportTally(world))) console.log(`  ${c} <- ${ids.join(", ")}`);
