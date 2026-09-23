import { gateway, generateText, Output, wrapLanguageModel } from "ai";
import { z } from "zod";
import { DEFAULT_LLM, type Generate } from "./generation.ts";
import { cacheKey, createCache } from "./model-cache.ts";
import { type ObserveModel, traceRequest } from "./model-events.ts";
export const reasoningEffort = () => process.env.LLM_EFFORT ?? "low";
export function createLlmClient(
  cachePath?: string,
  observe?: ObserveModel,
  resolveModel: (id: string) => ReturnType<typeof gateway> = gateway,
) {
  const cache = createCache<unknown>(cachePath);
  const llmStats = { calls: 0, cacheHits: 0, inputTokens: 0, outputTokens: 0, ms: 0 };
  const generate: Generate = async (args) => {
    const model = args.model ?? DEFAULT_LLM;
    const effort = reasoningEffort();

    const key = cacheKey({
      model,
      system: args.system,
      prompt: args.prompt,
      schema: z.toJSONSchema(args.schema),
      e: effort,
    });
    const cached = cache.get(key);
    if (cached !== undefined) {
      llmStats.cacheHits++;
      observe?.({ type: "cache.hit", model, source: "memory" });
      return args.schema.parse(cached);
    }
    const t0 = performance.now();
    const trace = traceRequest(model, observe);
    try {
      const r = await generateText({
        model: wrapLanguageModel({
          model: resolveModel(model),
          middleware: {
            specificationVersion: "v4",
            wrapGenerate: ({ doGenerate }) => trace.attempt(doGenerate),
          },
        }),
        system: args.system,
        prompt: args.prompt,
        output: Output.object({ schema: args.schema }),
        providerOptions: { openai: { reasoningEffort: effort } },
        maxRetries: 3,
      });
      llmStats.ms += performance.now() - t0;
      llmStats.calls++;
      llmStats.inputTokens += r.usage.inputTokens ?? 0;
      llmStats.outputTokens += r.usage.outputTokens ?? 0;
      cache.set(key, r.output);
      cache.flush();
      const result = args.schema.parse(r.output);
      trace.success({ inputTokens: r.usage.inputTokens, outputTokens: r.usage.outputTokens });
      return result;
    } catch (error) {
      trace.failure(error);
      throw error;
    }
  };

  return { generate, llmStats };
}
