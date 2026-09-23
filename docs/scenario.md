# シナリオ定義

このファイルは `src/cast.ts` と `src/constants.ts` から生成します。直接編集せず、定義を変更した後に `pnpm docs:generate` を実行してください。

17人、15件の事実、12件の証拠。12日間、1日3ターン。

## f_debt

Prince Edmund owes Guildmaster Petra a ruinous gambling debt.

- 関係者：Prince Edmund、Guildmaster Petra
- 当事者：Prince Edmund、Guildmaster Petra
- 暴かれて困る人：Prince Edmund
- 初期の知識：Prince Edmund、Sir Rowan、Guildmaster Petra
- 証拠：e_ious — Prince Edmund's signed note of debt（Guildmaster Petra）
- 暴露の効果：Guildmaster Petra, now openly Prince Edmund's creditor, is received at the King's bedside.
- 王への接触を得る：Guildmaster Petra

## f_letters

Prince Theodric has been exchanging secret letters with the King of Varenne.

- 関係者：Prince Theodric
- 当事者：Prince Theodric
- 暴かれて困る人：Prince Theodric
- 初期の知識：Prince Theodric、Lady Isolde、Queen Margery
- 証拠：e_letters — the bundle of letters from the King of Varenne（Prince Theodric）
- 暴露の効果：General Varric declares the army will never serve a friend of Varenne.
- 評価の変化：General Varric → Prince Theodric -2
- 評価の変化：King Aldric → Prince Theodric -1

## f_crest

A sealed letter bearing the Varenne crest was delivered to Prince Theodric's rooms.

- 関係者：Prince Theodric
- 当事者：Prince Theodric
- 暴かれて困る人：Prince Theodric
- 初期の知識：Captain Brand、Prince Theodric、Tam
- 証拠：なし
- 暴露の効果：Talk of a Varenne letter delivered to Prince Theodric's rooms spreads; the General grows suspicious of him.
- 評価の変化：General Varric → Prince Theodric -1
- 評価の変化：King Aldric → Prince Theodric -0.5

## f_courtship

Prince Cedric has secretly married Wenna, a common maid of the Queen's household, in a clandestine ceremony the church forbids.

- 関係者：Prince Cedric、Wenna
- 当事者：Prince Cedric、Wenna
- 暴かれて困る人：Prince Cedric、Wenna
- 初期の知識：Prince Cedric、Lysander、Wenna
- 証拠：e_marriage — the marriage certificate（Wenna）
- 暴露の効果：The Bishop's faith in Prince Cedric is shaken by his forbidden marriage.
- 評価の変化：Bishop Anselm → Prince Cedric -1.5

## f_skim

Chancellor Hubert has been skimming gold from the treasury for years.

- 関係者：Chancellor Hubert
- 当事者：Chancellor Hubert
- 暴かれて困る人：Chancellor Hubert
- 初期の知識：Guildmaster Petra、Chancellor Hubert
- 証拠：e_ledger — a copy of the treasury ledger（Guildmaster Petra）
- 暴露の効果：Chancellor Hubert is stripped of the chancellorship and barred from the King's presence.
- 王への接触を失う：Chancellor Hubert

## f_bribe

Physician Orlin takes money from Lady Isolde to praise Prince Theodric to the King.

- 関係者：Master Orlin、Lady Isolde、Prince Theodric
- 当事者：Master Orlin、Lady Isolde
- 暴かれて困る人：Master Orlin、Lady Isolde
- 初期の知識：Lady Isolde、Master Orlin
- 証拠：e_payments — the record of Lady Isolde's payments（Master Orlin）
- 暴露の効果：Physician Orlin is dismissed from the King's bedside for taking bribes.
- 王への接触を失う：Master Orlin

## f_brawl

Prince Edmund killed a man in a tavern brawl, and Captain Brand covered it up.

- 関係者：Prince Edmund、Captain Brand
- 当事者：Prince Edmund、Captain Brand
- 暴かれて困る人：Prince Edmund、Captain Brand
- 初期の知識：Prince Edmund、Sir Rowan、Captain Brand
- 証拠：e_watch — the suppressed night-watch report（Captain Brand）
- 暴露の効果：The King learns his eldest son killed a man and that the palace guard hid it; his fears about Edmund's temper are confirmed.
- 評価の変化：King Aldric → Prince Edmund -1.5
- 全員の信頼の変化：Captain Brand -1

## f_parentage

Prince Theodric is not the King's son; the Queen conceived him by another man.

- 関係者：Prince Theodric、Queen Margery
- 当事者：Queen Margery
- 暴かれて困る人：Prince Theodric、Queen Margery
- 初期の知識：Queen Margery、Master Orlin
- 証拠：e_midwife — the dead midwife's letter（Master Orlin）
- 暴露の効果：It is said Prince Theodric is not the King's son; the Queen is barred from the King's bedside.
- 王への接触を失う：Queen Margery
- 評価の変化：King Aldric → Prince Theodric -3

## f_doubt

Prince Cedric wrote to the Bishop that he feels unfit to rule and would rather take holy orders.

- 関係者：Prince Cedric、Bishop Anselm
- 当事者：Prince Cedric、Bishop Anselm
- 暴かれて困る人：Prince Cedric
- 初期の知識：Prince Cedric、Bishop Anselm
- 証拠：e_doubt — Prince Cedric's letter to the Bishop（Bishop Anselm）
- 暴露の効果：Prince Cedric's own letter shows he does not want the crown.
- 評価の変化：King Aldric → Prince Cedric -1
- 評価の変化：General Varric → Prince Cedric -1

## f_smuggling

Guildmaster Petra's guild smuggles goods from Varenne and carries Prince Theodric's letters.

- 関係者：Guildmaster Petra、Prince Theodric
- 当事者：Guildmaster Petra、Prince Theodric
- 暴かれて困る人：Guildmaster Petra、Prince Theodric
- 初期の知識：Guildmaster Petra、Prince Theodric、Lady Isolde、Chancellor Hubert
- 証拠：e_manifest — the guild's cargo manifest（Guildmaster Petra）
- 暴露の効果：Guildmaster Petra is shown to be smuggling for Varenne and carrying Prince Theodric's letters.
- 評価の変化：King Aldric → Prince Theodric -0.5
- 全員の信頼の変化：Guildmaster Petra -1.5

## f_lands

Bishop Anselm secretly sold church lands to the merchant guilds for his own purse.

- 関係者：Bishop Anselm、Guildmaster Petra
- 当事者：Bishop Anselm、Guildmaster Petra
- 暴かれて困る人：Bishop Anselm
- 初期の知識：Guildmaster Petra、Chancellor Hubert、Bishop Anselm
- 証拠：e_deed — the deed of the church lands（Chancellor Hubert）
- 暴露の効果：The Bishop who preaches piety is shown to have sold church lands for his own purse.
- 全員の信頼の変化：Bishop Anselm -1.5

## f_mutiny

General Varric has readied troops to seize the palace if Prince Theodric is named heir.

- 関係者：General Varric、Prince Edmund
- 当事者：General Varric
- 暴かれて困る人：General Varric、Prince Edmund
- 初期の知識：Sir Rowan、General Varric
- 証拠：e_orders — the General's marching orders（General Varric）
- 暴露の効果：General Varric's plan to seize the palace comes out; Prince Edmund looks like a prince who would take the crown by force.
- 評価の変化：King Aldric → Prince Edmund -1

## f_forgery

Lysander forged the chancery records that raised him from low birth.

- 関係者：Lysander
- 当事者：Lysander
- 暴かれて困る人：Lysander
- 初期の知識：Lysander、Chancellor Hubert
- 証拠：e_register — the altered chancery register（Chancellor Hubert）
- 暴露の効果：Lysander, the Prince's clerk, is shown to have forged his own rise.
- 全員の信頼の変化：Lysander -1.5

## f_army

General Varric has promised Prince Edmund the army's backing.

- 関係者：General Varric、Prince Edmund
- 当事者：General Varric、Prince Edmund
- 暴かれて困る人：なし
- 初期の知識：Prince Edmund、Sir Rowan、General Varric
- 証拠：なし
- 暴露の効果：なし

## f_month

The King has perhaps a month to live.

- 関係者：King Aldric
- 当事者：なし
- 暴かれて困る人：なし
- 初期の知識：Master Orlin、Godfrey、King Aldric
- 証拠：なし
- 暴露の効果：なし
