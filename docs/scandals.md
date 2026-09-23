# 事実とスキャンダルの定義

作成日：2026年9月23日。人物設定（`src/cast.ts`）はこの文書に合わせる。

## 事実ごとに決める要素

| 要素 | 意味 | 使われ方 |
| --- | --- | --- |
| 文面 | 事実そのもの（英語） | state、選択肢、告発 |
| 種類 | スキャンダル（誰かが困る）／有利な事実／情報 | 設計上の分類 |
| 当事者 | 文面から「知っているはず」と分かる人 | 知っていると分かる人の推定、脅しの経路から外す |
| 困る人 | 暴かれて困る人 | 脅しの材料になる相手、自陣営の弱みの判定 |
| 最初に知っている人 | 開始時点で知っている人 | 初期の知識 |
| 暴かれたときの結果 | 立場を失う・得る、評価や信頼が動く | 公の告発で過半数が信じたとき、または王が信じたとき |
| 証拠 | 物と、その最初の持ち主。無い事実もある | 示せば聞き手は強く信じる。渡す・脅して奪う・処分する |
| 筋の役割 | その事実で何が起きうるか | 設計の確認用 |

**設計の方針**

- 各候補に弱みを 2 つ持たせる。脅しと告発の標的が偏らないように。
- 支持者や運び手にも弱みを持たせる。王に会える人が失脚すると、王への経路が変わる。
- 各陣営が、少なくとも 1 つは敵の弱みを握れる配置にする。握っていないと脅しが起きない。
- 証拠は、弱みを持つ本人ではなく別の人が持つことを基本にする。「誰が持っているか」を巡る争奪が生まれる。

## 一覧

### 候補の弱み

**f_debt：Edmund の賭博の借金**
- 文面：Prince Edmund owes Guildmaster Petra a ruinous gambling debt.
- 当事者：Edmund、Petra ／ 困る人：Edmund
- 最初に知っている人：Edmund、Petra、Rowan
- 暴かれたとき：Petra が債権者として王に会えるようになる。
- 証拠：**借用書**（Edmund の署名入り）／持ち主 Petra
- 筋：Petra が Edmund 陣営を締め上げる材料。借用書を奪えば Edmund 陣営は Petra から解放される。

**f_brawl：Edmund の酒場での殺人**
- 文面：Prince Edmund killed a man in a tavern brawl, and Captain Brand covered it up.
- 当事者：Edmund、Brand ／ 困る人：Edmund、Brand
- 最初に知っている人：Edmund、Brand、Rowan
- 暴かれたとき：王の Edmund への評価が大きく下がる（短気で判断が危うい、という懸念が裏付けられる）。王宮の全員の Brand への信頼が下がる。
- 証拠：**揉み消した夜警の報告書**／持ち主 Brand
- 筋：Brand は Rowan に恩がある忠臣だが、この件では自分も困る。Brand を脅せば Edmund 陣営の内側が揺れる。

**f_letters：Theodric と Varenne 王の密書**
- 文面：Prince Theodric has been exchanging secret letters with the King of Varenne.
- 当事者：Theodric ／ 困る人：Theodric
- 最初に知っている人：Theodric、Isolde、王妃
- 暴かれたとき：将軍の Theodric への評価が大きく下がり（軍は Varenne の友に仕えない）、王の評価も下がる。
- 証拠：**Varenne 王からの手紙の束**／持ち主 Theodric
- 筋：最大の爆弾。手紙の束を奪えれば Theodric は終わる。Theodric 陣営は処分するかどうかで揺れる。

**f_crest：Varenne の封蝋の手紙が届いた**
- 文面：A sealed letter bearing the Varenne crest was delivered to Prince Theodric's rooms.
- 当事者：Theodric ／ 困る人：Theodric
- 最初に知っている人：Theodric、Tam、Brand（門で Varenne の使者を見た）
- 暴かれたとき：将軍の Theodric への評価が下がり、王の評価も少し下がる（密書の疑いを裏付ける目撃）。
- 証拠：なし（小姓の Tam が証人）
- 筋：身分の低い目撃者が起点になる噂。密書の証拠を探す手がかりになる。

**f_parentage：Theodric は王の子ではない**
- 文面：Prince Theodric is not the King's son; the Queen conceived him by another man.
- 当事者：王妃（Theodric 本人は知らないので当事者に含めない）／ 困る人：Theodric、王妃
- 最初に知っている人：王妃、Orlin（出産に立ち会った侍医）
- 暴かれたとき：王の Theodric への評価が致命的に下がる。王妃が王に会えなくなる。
- 証拠：**亡き産婆の手紙**／持ち主 Orlin
- 筋：Theodric 本人も知らない秘密。強欲な Orlin が、使うか売るかを握っている。

**f_courtship：Cedric の禁じられた密婚**
- 文面：Prince Cedric has secretly married Wenna, a common maid of the Queen's household, in a clandestine ceremony the church forbids.
- 当事者：Cedric、Wenna ／ 困る人：Cedric、Wenna
- 最初に知っている人：Cedric、Wenna、Lysander
- 暴かれたとき：司教の Cedric への評価が大きく下がる。
- 証拠：**婚姻の証書**／持ち主 Wenna
- 筋：敵陣営の王妃の部屋に仕える Wenna が証書を持っている。Cedric 陣営の最大の弱点。

**f_doubt：Cedric は王になる気がない**
- 文面：Prince Cedric wrote to the Bishop that he feels unfit to rule and would rather take holy orders.
- 当事者：Cedric、司教 ／ 困る人：Cedric
- 最初に知っている人：Cedric、司教
- 暴かれたとき：王の Cedric への評価が下がり、将軍の評価も下がる（王冠を望まない王子に国は任せられない）。
- 証拠：**司教宛ての手紙**／持ち主 司教
- 筋：味方の司教が握る Cedric の弱み。司教が寝返れば Cedric 陣営は崩れる。

### 支持者と運び手の弱み

**f_skim：宰相 Hubert の横領**
- 文面：Chancellor Hubert has been skimming gold from the treasury for years.
- 当事者：Hubert ／ 困る人：Hubert
- 最初に知っている人：Hubert、Petra
- 暴かれたとき：宰相の職を失い、王に会えなくなる。
- 証拠：**宝物庫の帳簿の写し**／持ち主 Petra
- 筋：Petra が Hubert を操る材料（これまでの実行でも中心になった）。

**f_bribe：侍医 Orlin の買収**
- 文面：Physician Orlin takes money from Lady Isolde to praise Prince Theodric to the King.
- 当事者：Orlin、Isolde ／ 困る人：Orlin、Isolde
- 最初に知っている人：Orlin、Isolde
- 暴かれたとき：Orlin が王に会えなくなる。
- 証拠：**Isolde の支払いの記録**／持ち主 Orlin
- 筋：Orlin は保身のために記録を手元に残している。Theodric 陣営の内側の火種。

**f_smuggling：Petra の Varenne との密貿易**
- 文面：Guildmaster Petra's guild smuggles goods from Varenne and carries Prince Theodric's letters.
- 当事者：Petra、Theodric ／ 困る人：Petra、Theodric
- 最初に知っている人：Petra、Theodric、Isolde、Hubert（関税の記録から）
- 暴かれたとき：王の Theodric への評価が下がる。王宮の全員の Petra への信頼が大きく下がる。
- 証拠：**積荷の目録**／持ち主 Petra
- 筋：秘密を売る側の Petra にも弱みがある。Petra を脅せる手がかりで、密書の件ともつながる。

**f_lands：司教の教会領の密売**
- 文面：Bishop Anselm secretly sold church lands to the merchant guilds for his own purse.
- 当事者：司教、Petra ／ 困る人：司教
- 最初に知っている人：司教、Petra、Hubert（権利の移転を記録した）
- 暴かれたとき：王宮の全員の司教への信頼が大きく下がる（敬虔を説く者の偽善）。
- 証拠：**譲渡証書**／持ち主 Hubert
- 筋：Cedric 陣営の柱である司教の弱み。同じ陣営の Hubert が証書を持つ。

**f_mutiny：将軍の宮殿制圧の備え**
- 文面：General Varric has readied troops to seize the palace if Prince Theodric is named heir.
- 当事者：Varric ／ 困る人：Varric、Edmund
- 最初に知っている人：Varric、Rowan
- 暴かれたとき：王の Edmund への評価が下がる（軍を背に王位を奪う王子と見られる）。
- 証拠：**出撃の命令書**／持ち主 Varric
- 筋：Edmund 陣営の強みである軍の支持が、裏返ると弱みになる。

**f_forgery：Lysander の出自の偽造**
- 文面：Lysander forged the chancery records that raised him from low birth.
- 当事者：Lysander ／ 困る人：Lysander
- 最初に知っている人：Lysander、Hubert（元の上役）
- 暴かれたとき：王宮の全員の Lysander への信頼が大きく下がる。
- 証拠：**書き換えた記録簿**／持ち主 Hubert
- 筋：主人公自身の弱み。同じ陣営の Hubert が握っている。Hubert が脅されると、主人公にも火が及ぶ。

### 有利な事実と情報

**f_army：将軍が Edmund に軍の支持を約束**
- 文面：General Varric has promised Prince Edmund the army's backing.
- 当事者：Varric、Edmund ／ 困る人：なし
- 最初に知っている人：Varric、Edmund、Rowan
- 暴かれたとき：なし（Edmund 陣営が王に伝えたい事実）
- 証拠：なし

**f_month：王の余命はひと月ほど**
- 文面：The King has perhaps a month to live.
- 当事者：なし ／ 困る人：なし
- 最初に知っている人：Orlin、Godfrey、王
- 暴かれたとき：なし
- 証拠：なし

## 各陣営が握る敵の弱み（開始時点）

| 陣営 | 握っている敵の弱み | 敵に握られている自分の弱み |
| --- | --- | --- |
| Edmund | 封蝋（Brand。証拠なし） | 借金（Petra が証拠も持つ） |
| Cedric | 密貿易（Hubert。証拠は Petra） | 横領（Petra が証拠も持つ）、司教の密売（Petra） |
| Theodric | 借金、横領、司教の密売（すべて Petra） | 封蝋（Brand、Tam）、密貿易（Hubert） |
| どこにも属さない | 封蝋（Tam）、余命（Godfrey） | なし |

Theodric 陣営は Petra を通じて最も多くの弱みを握るが、Petra 自身の密貿易を Hubert に握られている。Edmund 陣営と Cedric 陣営は、敵の弱みを 1 つずつしか持たずに始まる。探ること、目撃を集めることが最初の仕事になる。

## 証拠の仕組み

- **保管は個人、使う権利は陣営**：証拠は誰か 1 人が預かる。陣営の仲間が預かっている証拠は、預かり手が陣営に知らせていれば、その事実を知っている仲間の誰でも示せる（陣営 = 同じ候補を支持し、脅されて寝返っていない人）。知らせるかは預かり手が毎日の個人の整理で選ぶ。仲間への保険として隠す証拠もある（Orlin の支払いの記録など）。どこにも属さない人と、脅されて寝返った人は、自分の預かる証拠だけを使える。預かり手が寝返れば、証拠も持っていかれる。
- **選択肢に示せる証拠を書く**：伝える・告発・依頼・脅しの選択肢の文面に、その手で示せる証拠を書き添える。
- **示す**：その証拠を使える人が、その事実を伝えたり告発したりすると、証拠を示したことになる。見た人の「信じる」は 0.85 を下限にする（文面に添えるだけでは +0.1 しか効かなかったため）。偽造を入れる段階で見直す。
- **持ち主が知られる**：証拠を示すと、見た人は「この人が持っている」と知る。奪う標的になる。
- **渡す**：預かり手が、陣営の外の誰か（王以外）に渡す。陣営の中の持ち替えは意味がないので選べない（実測で、陣営の中の持ち替えが証拠付きの告発の機会を壊していた）。
  - **頼みを付けて託す**：王に会える相手には「王に届けてほしい」、会えない相手には「預かってほしい」と頼む。相手が引き受けたときだけ証拠が移り、王に届ける約束は相手の選択肢に「約束した」の印として付く（依頼と同じ）。断られたら証拠は渡さない。見せた証拠で、相手はその事実を知る（実測で、頼みのない受け渡しは、受け取った侍従が王に届けず、証拠を手放しただけになった）。
  - **自陣営を困らせる証拠を渡すのは、預かり手本人の判断に限る**：頭目は指示できない（実測で、将軍が自分の命令書を頭目の指示どおり侍従に渡し、自陣営の反逆が暴かれた）。
- **脅して奪う**：その証拠の持ち主が困る秘密を知っていれば、「証拠を渡さなければ暴く」と脅せる。応じ方は脅しと同じ 4 つ。屈すれば証拠が移る。
- **処分する**：持ち主が燃やす。自陣営の弱みの証拠を消せる。燃やしたことは本人だけが知る。**処分は持ち主本人の判断に限り、頭目は指示できない**（実測で、頭目が 1 日目に処分を指示し、持ち主が従って主要な証拠がすべて消えた。持ち主には、危険でも手放せない理由を人物設定に書いてある）。
- **脅して奪う**：味方の持つ証拠は対象にしない（渡してもらえばよい）。
- **盗む**：後回し（部屋への出入りと目撃の仕組みが要るため、汚い手の組と一緒に入れる）。
- 宮廷での告発を経路にした脅しは、実行の期限を 2 日にする（下地を作る時間を残すため）。
