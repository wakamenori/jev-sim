// 1 日目の初期世界で、指定した種類の行動の選択肢を人物ごとに並べる。  node scripts/list-actions.ts extort give destroy
import { buildWorld, enumerateActions } from "../src/sim.ts";

const kinds = process.argv.slice(2);
const w = buildWorld();
w.day = 1;
for (const id of Object.keys(w.people)) {
  const keys = enumerateActions(w, id).filter((k) => kinds.some((x) => k.startsWith(`${x}:`)));
  const counts = kinds.map((x) => `${x} ${keys.filter((k) => k.startsWith(`${x}:`)).length}`).join(", ");
  const total = enumerateActions(w, id).length;
  if (keys.length)
    console.log(
      `${id.padEnd(9)} 全 ${total} 手 | ${counts} | 例: ${keys
        .filter((k) => !k.startsWith("give:"))
        .slice(0, 4)
        .join(" ")}`,
    );
}
