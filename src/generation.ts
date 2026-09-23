import type { z } from "zod";
export const DEFAULT_LLM = "openai/gpt-6-luna";
export type Generate = <T>(args: {
  model?: string;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
}) => Promise<T>;
