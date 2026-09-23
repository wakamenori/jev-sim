import { makeRng } from "../random.ts";
import type { Event } from "../types.ts";
export const CHANGE_LEVELS = ["much worse", "somewhat worse", "unchanged", "somewhat better", "much better"];
export const TRUST_CHANGE = [
  "much less trust",
  "somewhat less trust",
  "unchanged",
  "somewhat more trust",
  "much more trust",
];

export const EVIDENCE_FLOOR = 0.85;
export const URGE_WEIGHT = 0.2;
export const yes = (p: number, seed: string) => makeRng(seed)() < p;
export type Apply = (cause: Event) => string | undefined;
