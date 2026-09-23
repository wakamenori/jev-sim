import { createJevClient } from "../src/jev.ts";
import { createLlmClient } from "../src/llm.ts";
export const { ask, stats, saveCache } = createJevClient({ cachePath: "cache/jev-cache.json" });
export const { generate, llmStats } = createLlmClient("cache/llm-cache.json");
