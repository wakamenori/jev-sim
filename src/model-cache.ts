import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** Each client owns its in-memory cache. Omit a path for memory-only use. */
export function createCache<T>(path?: string) {
  let entries: Record<string, T> | undefined;
  let dirty = false;
  const load = () => (entries ??= path && existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {});
  return {
    get(key: string): T | undefined {
      return load()[key];
    },
    set(key: string, value: T) {
      load()[key] = value;
      dirty = true;
    },
    flush() {
      if (!path || !dirty) return;
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(load()));
      dirty = false;
    },
  };
}

export const cacheKey = (input: unknown) => createHash("sha256").update(JSON.stringify(input)).digest("hex");
