// 最新の out/runs/*.json を使い、viewer の全コンポーネントをサーバー側で描画する。
// ログ構造を変えたあとに viewer が壊れていないかを確かめる。
import { createServer } from "vite";

const server = await createServer({
  configFile: "viewer/vite.config.ts",
  server: { middlewareMode: true },
  appType: "custom",
});
try {
  const m = await server.ssrLoadModule("/smoke/render.tsx");
  console.log(
    JSON.stringify(m.run("/Users/matsukokuumahikari/ghq/github.com/wakamenori/jev-sim/out/runs"), null, 1),
  );
} finally {
  await server.close();
}
