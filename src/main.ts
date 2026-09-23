// 干渉なしのベースライン実行。  pnpm baseline [--until N] [--verbose]
import { errorInfo } from "./model-events.ts";
import { runSim, supportTally } from "./run.ts";

const arg = (k: string) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const until = arg("--until");
try {
  const { world } = await runSim({
    handleSignals: true,
    until: until ? Number(until) : undefined,
    verbose: process.argv.includes("--verbose"),
  });
  if (process.argv.includes("--verbose"))
    for (const [c, ids] of Object.entries(supportTally(world))) console.log(`  ${c} <- ${ids.join(", ")}`);
} catch (error) {
  console.error(`[run] error ${JSON.stringify(errorInfo(error))}`);
  process.exitCode = 1;
}
