import { experimental_evaluate as evaluate } from "ai";

const t0 = performance.now();
const result = await evaluate({
  model: "typesafe-ai/jev",
  state: "The support agent issued a full refund to the customer.",
  questions: {
    refunded: { type: "boolean", instructions: "Was a refund issued?" },
  },
});
console.log(
  JSON.stringify(
    {
      ms: Math.round(performance.now() - t0),
      answers: result.answers,
      usage: result.usage,
      warnings: result.warnings,
      meta: result.providerMetadata,
      model: result.response?.modelId,
    },
    null,
    2,
  ),
);
