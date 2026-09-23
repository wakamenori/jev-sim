import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  // out/runs/*.json をリポジトリ外（viewer の外）から読むため
  server: { fs: { allow: [repoRoot] } },
});
