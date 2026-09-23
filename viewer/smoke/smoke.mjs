// 固定回答で生成した世界（または指定したログ）で、viewer をサーバー側描画する。
// ログ構造を変えたあとに viewer が壊れていないかを確かめる。
import { createServer } from "vite";

const server = await createServer({
  configFile: "viewer/vite.config.ts",
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  appType: "custom",
});
try {
  const m = await server.ssrLoadModule("/smoke/render.tsx");
  console.log(JSON.stringify(await m.run(process.argv[2]), null, 1));
} finally {
  await server.close();
}
