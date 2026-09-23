import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../src", import.meta.url));
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

test("production never imports verification code and has no circular module dependencies", () => {
  const graph = new Map<string, string[]>();
  for (const file of files(root).filter((file) => file.endsWith(".ts"))) {
    const imports = [...readFileSync(file, "utf8").matchAll(/\bfrom\s+["']([^"']+)["']/g)].map(
      (match) => match[1],
    );
    assert.ok(
      imports.every((path) => !/(experiments|tests|scripts)\//.test(path)),
      file,
    );
    graph.set(
      file,
      imports.filter((path) => path.startsWith(".")).map((path) => resolve(dirname(file), path)),
    );
  }
  const done = new Set<string>();
  const visit = (file: string, chain: string[]) => {
    assert.ok(!chain.includes(file), `Circular dependency: ${[...chain, file].join(" -> ")}`);
    if (done.has(file)) return;
    for (const next of graph.get(file) ?? []) visit(next, [...chain, file]);
    done.add(file);
  };
  for (const file of graph.keys()) visit(file, []);
});
