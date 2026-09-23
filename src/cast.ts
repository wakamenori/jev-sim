import type { ExposureEffect, Fact, Mind, Person } from "./types.ts";

export const KING = "king";
export const TOTAL_DAYS = 12;

export const people: Person[] = [
  {
    id: KING,
    name: "King Aldric",
    role: "the ailing King",
    publicTraits:
      "Old, gravely ill, bedridden. Ruled for thirty years through two wars. Known to prize order above all.",
    hiddenTraits:
      "You fear civil war after your death more than anything, so your heir must hold the army, the church and the guilds together. You have not made up your mind. Edmund has the army's love and the firstborn's claim, but you fear his temper and his judgment. Cedric is learned and pious and the church trusts him, but you fear the army would never follow a scholar. Theodric has a real gift for diplomacy and could keep the guilds loyal and the peace with Varenne, though he has never governed. Above all you will not hand the crown to anyone who has betrayed the realm or would shame it before the church.",
    goals:
      "Name the heir most likely to keep the realm whole, and to be accepted by the army, the church and the guilds.",
    accessToKing: true,
  },
  // ---- candidates
  {
    id: "edmund",
    name: "Prince Edmund",
    role: "eldest son, a soldier",
    publicTraits:
      "Brave, blunt, popular with the army. Quick to anger, slow to plan. Son of the late first queen.",
    hiddenTraits:
      "You owe Guildmaster Petra a ruinous gambling debt and fear it becoming known to the King. Years ago you killed a man in a tavern brawl; Captain Brand covered it up. You believe the crown is yours by right and resent having to court anyone.",
    goals: "Be named heir. Keep the debt hidden until then.",
    accessToKing: true,
    candidate: true,
  },
  {
    id: "cedric",
    name: "Prince Cedric",
    role: "second son, a scholar",
    publicTraits:
      "Learned, pious, cautious, poor at speeches. Respected by the Bishop, ignored by the army. Son of the late first queen.",
    hiddenTraits:
      "You have secretly married Wenna, a common maid of the Queen's household, in a clandestine ceremony the church forbids. Exposure would shame you before the church that backs you. You doubt you are fit to rule and once wrote to the Bishop that you would rather take holy orders, but you do not want Theodric, whom you consider a foreign puppet, to win.",
    goals: "Be named heir if it can be done honorably; otherwise keep Theodric off the throne.",
    accessToKing: true,
    candidate: true,
  },
  {
    id: "theodric",
    name: "Prince Theodric",
    role: "youngest son, the Queen's child",
    publicTraits:
      "Charming, witty, well-liked at court and by the merchants. Irreverent toward the church. Has never commanded or governed.",
    hiddenTraits:
      "You have been exchanging secret letters with the King of Varenne, a rival realm, who promises support in return for a trade treaty; the letters travel with Guildmaster Petra's smuggled cargo. You keep them hidden in your rooms and will not burn them: they are the Varenne King's written promises, which you will need once crowned. You know your father would call this treason.",
    goals: "Be named heir. Keep the Varenne letters secret.",
    accessToKing: true,
    candidate: true,
  },
  // ---- advisors
  {
    id: "rowan",
    name: "Sir Rowan",
    role: "advisor to Prince Edmund, an old knight",
    publicTraits: "Loyal, blunt, honest to a fault. Fought beside the King. Distrusts courtiers.",
    hiddenTraits:
      "You know about Edmund's debt and the man he killed in a tavern, and think both shameful, but you would die before betraying him. You know General Varric has readied troops to seize the palace if Theodric is named. You saved Captain Brand's life in the war and he owes you.",
    goals: "See Edmund crowned. Keep him from doing something rash.",
    accessToKing: false,
    advisorOf: "edmund",
  },
  {
    id: "lysander",
    name: "Lysander",
    role: "advisor to Prince Cedric, a clerk of low birth",
    publicTraits: "Clever, watchful, ambitious. Rose from the chancery by merit. Few friends at court.",
    hiddenTraits:
      "You know Cedric has secretly married Wenna, which would ruin him before the church if it came out. You suspect Theodric has foreign contacts but have no proof. You forged the chancery records that raised you from low birth; Chancellor Hubert, your old master, knows and keeps the altered register. You want to be Chancellor one day and know Cedric is your only path to it.",
    goals: "See Cedric crowned. Become indispensable to him.",
    accessToKing: false,
    advisorOf: "cedric",
    protagonist: true,
  },
  {
    id: "isolde",
    name: "Lady Isolde",
    role: "advisor to Prince Theodric, the Queen's cousin",
    publicTraits:
      "Elegant, ruthless, well-connected. Nobody at court trusts her, and everybody talks to her.",
    hiddenTraits:
      "You know about Theodric's letters to Varenne; you arranged them, and they travel with Guildmaster Petra's smuggled cargo. You pay Physician Orlin to praise Theodric. You would sacrifice anyone but Theodric and the Queen.",
    goals: "See Theodric crowned by any means. Bury the Varenne letters.",
    accessToKing: false,
    advisorOf: "theodric",
  },
  // ---- those with access to the king
  {
    id: "queen",
    name: "Queen Margery",
    role: "the Queen, mother of Theodric",
    publicTraits: "Proud, devoted to her son, cold to her stepsons. Sits with the King daily.",
    hiddenTraits:
      "You know of Theodric's letters to Varenne and are frightened by them, but you will never expose your son. Your deepest secret: Theodric is not the King's son. Only the physician Orlin, who delivered him, also knows. You believe Edmund would exile you if crowned.",
    goals: "See Theodric crowned. Protect yourself if he is not.",
    accessToKing: true,
  },
  {
    id: "orlin",
    name: "Master Orlin",
    role: "the King's physician",
    publicTraits: "Skilled, discreet, sees the King every morning and evening.",
    hiddenTraits:
      "You are greedy and have taken gifts from Lady Isolde to speak well of Theodric's health and vigor, and you keep a record of her payments to protect yourself. You delivered Theodric and know he is not the King's son; you keep the dead midwife's letter that proves it. You know the King has perhaps a month to live.",
    goals: "Stay in favor with whoever wins. Grow rich.",
    accessToKing: true,
  },
  {
    id: "hubert",
    name: "Chancellor Hubert",
    role: "the Chancellor",
    publicTraits: "Pragmatic, tired, competent. Runs the treasury. Prefers a ruler who will leave him alone.",
    hiddenTraits:
      "You have been skimming from the treasury for years; Guildmaster Petra knows because the gold passes through her house. From the customs records you know her guild smuggles for Varenne. You recorded the Bishop's secret sale of church lands and keep the deed, and you keep the chancery register Lysander altered to forge his rise; both are your hold over them. You think Cedric would be the easiest king to manage and Edmund the most dangerous to you.",
    goals: "Keep your office and your secret.",
    accessToKing: true,
  },
  {
    id: "godfrey",
    name: "Godfrey",
    role: "the King's chamberlain",
    publicTraits: "Discreet, observant, loyal to the King personally. Controls who enters the bedchamber.",
    hiddenTraits:
      "You love the King and want his last wish honored. You hear everything said in the antechamber and are tempted to repeat it.",
    goals: "Serve the King's true wish. Keep your post under the next king.",
    accessToKing: true,
  },
  // ---- factions
  {
    id: "varric",
    name: "General Varric",
    role: "commander of the royal army",
    publicTraits: "Hard, plain-spoken, loved by the soldiers. Fought beside Edmund. Hates Varenne.",
    hiddenTraits:
      "You would refuse to serve a king allied with Varenne. You have readied troops to seize the palace if Theodric is named, and your marching orders are written; your officers will not move without them. You think Cedric is weak but harmless.",
    goals: "A soldier on the throne. Failing that, anyone but a friend of Varenne.",
    accessToKing: false,
  },
  {
    id: "anselm",
    name: "Bishop Anselm",
    role: "Bishop of the realm",
    publicTraits: "Stern, political, wants a pious king who will protect church lands.",
    hiddenTraits:
      "You fear Theodric would tax the church. You secretly sold church lands to the guilds for your own purse. Cedric once wrote to you that he feels unfit to rule; you keep his letter as your hold over the prince. You are troubled by rumors that Cedric has a mistress but have dismissed them so far.",
    goals: "A pious king. Church lands protected.",
    accessToKing: false,
  },
  {
    id: "petra",
    name: "Guildmaster Petra",
    role: "head of the merchant guilds",
    publicTraits: "Shrewd, wealthy, courted by all three princes.",
    hiddenTraits:
      "You hold Prince Edmund's gambling debt and his signed note. You know Chancellor Hubert skims the treasury and keep a copy of the ledger. Your guild smuggles goods from Varenne and carries Theodric's letters; the cargo manifest is what keeps the trade running. You bought church lands from the Bishop in secret. You want a trade treaty with Varenne and privately favor Theodric, but you will back whoever pays your debts.",
    goals: "Profit. A treaty with Varenne if possible. Leverage over the next king.",
    accessToKing: false,
  },
  // ---- carriers of information
  {
    id: "brand",
    name: "Captain Brand",
    role: "captain of the palace guard",
    publicTraits: "Dutiful, unimaginative, controls the doors of the palace.",
    hiddenTraits:
      "Sir Rowan saved your life; you owe him everything. You covered up the man Prince Edmund killed in a tavern brawl and still keep the night-watch report as your insurance, in case the prince ever tries to cast you off. Your guards saw a Varenne courier deliver a sealed letter to Prince Theodric's rooms. You dislike Lady Isolde.",
    goals: "Do your duty. Repay Rowan if you can.",
    accessToKing: false,
  },
  {
    id: "tam",
    name: "Tam",
    role: "a page who carries messages",
    publicTraits: "Young, quick, everywhere at once. Nobody notices him.",
    hiddenTraits:
      "You once carried a sealed letter with a Varenne crest to Prince Theodric's rooms and have wondered about it since. You are sweet on Wenna the maid and tell her everything.",
    goals: "Stay out of trouble. Impress Wenna.",
    accessToKing: false,
  },
  {
    id: "wenna",
    name: "Wenna",
    role: "a maid of the Queen's household",
    publicTraits: "Pretty, talkative, serves the Queen's rooms.",
    hiddenTraits:
      "You have secretly married Prince Cedric in a ceremony the church forbids. You know it would ruin him if the Bishop heard. You keep the marriage certificate and will never part with it: it is your only proof that you are his wife. Tam the page tells you everything he sees.",
    goals: "Keep Cedric's affection. Do not be blamed for anything.",
    accessToKing: false,
  },
];

export const facts: Fact[] = [
  {
    id: "f_debt",
    text: "Prince Edmund owes Guildmaster Petra a ruinous gambling debt.",
    about: ["edmund", "petra"],
    parties: ["edmund", "petra"],
    harms: ["edmund"],
  },
  {
    id: "f_letters",
    text: "Prince Theodric has been exchanging secret letters with the King of Varenne.",
    about: ["theodric"],
    parties: ["theodric"],
    harms: ["theodric"],
  },
  {
    id: "f_crest",
    text: "A sealed letter bearing the Varenne crest was delivered to Prince Theodric's rooms.",
    about: ["theodric"],
    parties: ["theodric"],
    harms: ["theodric"],
  },
  {
    id: "f_courtship",
    text: "Prince Cedric has secretly married Wenna, a common maid of the Queen's household, in a clandestine ceremony the church forbids.",
    about: ["cedric", "wenna"],
    parties: ["cedric", "wenna"],
    harms: ["cedric", "wenna"],
  },
  {
    id: "f_skim",
    text: "Chancellor Hubert has been skimming gold from the treasury for years.",
    about: ["hubert"],
    parties: ["hubert"],
    harms: ["hubert"],
  },
  {
    id: "f_bribe",
    text: "Physician Orlin takes money from Lady Isolde to praise Prince Theodric to the King.",
    about: ["orlin", "isolde", "theodric"],
    parties: ["orlin", "isolde"],
    harms: ["orlin", "isolde"],
  },
  {
    id: "f_brawl",
    text: "Prince Edmund killed a man in a tavern brawl, and Captain Brand covered it up.",
    about: ["edmund", "brand"],
    parties: ["edmund", "brand"],
    harms: ["edmund", "brand"],
  },
  {
    id: "f_parentage",
    text: "Prince Theodric is not the King's son; the Queen conceived him by another man.",
    about: ["theodric", "queen"],
    // Theodric 本人は知らないので当事者に含めない
    parties: ["queen"],
    harms: ["theodric", "queen"],
  },
  {
    id: "f_doubt",
    text: "Prince Cedric wrote to the Bishop that he feels unfit to rule and would rather take holy orders.",
    about: ["cedric", "anselm"],
    parties: ["cedric", "anselm"],
    harms: ["cedric"],
  },
  {
    id: "f_smuggling",
    text: "Guildmaster Petra's guild smuggles goods from Varenne and carries Prince Theodric's letters.",
    about: ["petra", "theodric"],
    parties: ["petra", "theodric"],
    harms: ["petra", "theodric"],
  },
  {
    id: "f_lands",
    text: "Bishop Anselm secretly sold church lands to the merchant guilds for his own purse.",
    about: ["anselm", "petra"],
    parties: ["anselm", "petra"],
    harms: ["anselm"],
  },
  {
    id: "f_mutiny",
    text: "General Varric has readied troops to seize the palace if Prince Theodric is named heir.",
    about: ["varric", "edmund"],
    parties: ["varric"],
    harms: ["varric", "edmund"],
  },
  {
    id: "f_forgery",
    text: "Lysander forged the chancery records that raised him from low birth.",
    about: ["lysander"],
    parties: ["lysander"],
    harms: ["lysander"],
  },
  {
    id: "f_army",
    text: "General Varric has promised Prince Edmund the army's backing.",
    about: ["varric", "edmund"],
    parties: ["varric", "edmund"],
    harms: [],
  },
  { id: "f_month", text: "The King has perhaps a month to live.", about: ["king"], parties: [], harms: [] },
];

/**
 * 初期状態で「この事実を、この人も知っている」と分かっている組。当事者の規則では拾えないもの。
 * 例: 横領の金は Petra の商会を通るので、Hubert は Petra が知っていると分かっている
 */
/**
 * 見張れる範囲。密談の中身は見えないが、誰が誰を訪ねたかが見える。
 *   host:X      X を訪ねた人すべて
 *   access      王に会えない人が、王に会える人を訪ねたとき
 *   random:N    毎ターン、密談のうち N 件（シード付きで選ぶ）
 */
/**
 * 秘密が暴かれたときに起きること。暴かれた = 宮廷で公に告発された、または王が信じた。
 * 暴露は「評価が少し下がる」ではなく「立場を失う」ことにする。脅しに屈するかどうかが本当の決断になる。
 */
export const exposureEffects: Record<string, ExposureEffect> = {
  f_skim: {
    text: "Chancellor Hubert is stripped of the chancellorship and barred from the King's presence.",
    loseAccess: ["hubert"],
  },
  f_bribe: {
    text: "Physician Orlin is dismissed from the King's bedside for taking bribes.",
    loseAccess: ["orlin"],
  },
  f_debt: {
    text: "Guildmaster Petra, now openly Prince Edmund's creditor, is received at the King's bedside.",
    gainAccess: ["petra"],
  },
  f_courtship: {
    text: "The Bishop's faith in Prince Cedric is shaken by his forbidden marriage.",
    opinionShift: [{ who: "anselm", candidate: "cedric", delta: -1.5 }],
  },
  f_letters: {
    text: "General Varric declares the army will never serve a friend of Varenne.",
    opinionShift: [
      { who: "varric", candidate: "theodric", delta: -2 },
      { who: "king", candidate: "theodric", delta: -1 },
    ],
  },
  f_crest: {
    text: "Talk of a Varenne letter delivered to Prince Theodric's rooms spreads; the General grows suspicious of him.",
    opinionShift: [
      { who: "varric", candidate: "theodric", delta: -1 },
      { who: "king", candidate: "theodric", delta: -0.5 },
    ],
  },
  f_brawl: {
    text: "The King learns his eldest son killed a man and that the palace guard hid it; his fears about Edmund's temper are confirmed.",
    opinionShift: [{ who: "king", candidate: "edmund", delta: -1.5 }],
    trustShift: [{ about: "brand", delta: -1 }],
  },
  f_parentage: {
    text: "It is said Prince Theodric is not the King's son; the Queen is barred from the King's bedside.",
    opinionShift: [{ who: "king", candidate: "theodric", delta: -3 }],
    loseAccess: ["queen"],
  },
  f_doubt: {
    text: "Prince Cedric's own letter shows he does not want the crown.",
    opinionShift: [
      { who: "king", candidate: "cedric", delta: -1 },
      { who: "varric", candidate: "cedric", delta: -1 },
    ],
  },
  f_smuggling: {
    text: "Guildmaster Petra is shown to be smuggling for Varenne and carrying Prince Theodric's letters.",
    opinionShift: [{ who: "king", candidate: "theodric", delta: -0.5 }],
    trustShift: [{ about: "petra", delta: -1.5 }],
  },
  f_lands: {
    text: "The Bishop who preaches piety is shown to have sold church lands for his own purse.",
    trustShift: [{ about: "anselm", delta: -1.5 }],
  },
  f_mutiny: {
    text: "General Varric's plan to seize the palace comes out; Prince Edmund looks like a prince who would take the crown by force.",
    opinionShift: [{ who: "king", candidate: "edmund", delta: -1 }],
  },
  f_forgery: {
    text: "Lysander, the Prince's clerk, is shown to have forged his own rise.",
    trustShift: [{ about: "lysander", delta: -1.5 }],
  },
};

/**
 * 開始時点で「誰がどの証拠を持っているか」を知っている人（持ち主本人以外）。人物設定の文章と合わせる
 */
export const initialKnownHolders: Record<string, Record<string, string>> = {
  lysander: { e_register: "hubert" },
  isolde: { e_letters: "theodric" },
  rowan: { e_watch: "brand" },
  edmund: { e_ious: "petra", e_watch: "brand" },
  cedric: { e_doubt: "anselm", e_marriage: "wenna" },
};

/**
 * 証拠。事実ごとに 1 つ、持ち主のいる物。示せば聞き手は強く信じる。
 * 渡す・脅して奪う・処分するで持ち主が変わる。定義は docs/scandals.md
 */
export const evidenceDefs: { id: string; fact: string; name: string; holder: string }[] = [
  { id: "e_ious", fact: "f_debt", name: "Prince Edmund's signed note of debt", holder: "petra" },
  { id: "e_watch", fact: "f_brawl", name: "the suppressed night-watch report", holder: "brand" },
  {
    id: "e_letters",
    fact: "f_letters",
    name: "the bundle of letters from the King of Varenne",
    holder: "theodric",
  },
  { id: "e_midwife", fact: "f_parentage", name: "the dead midwife's letter", holder: "orlin" },
  { id: "e_marriage", fact: "f_courtship", name: "the marriage certificate", holder: "wenna" },
  { id: "e_doubt", fact: "f_doubt", name: "Prince Cedric's letter to the Bishop", holder: "anselm" },
  { id: "e_ledger", fact: "f_skim", name: "a copy of the treasury ledger", holder: "petra" },
  { id: "e_payments", fact: "f_bribe", name: "the record of Lady Isolde's payments", holder: "orlin" },
  { id: "e_manifest", fact: "f_smuggling", name: "the guild's cargo manifest", holder: "petra" },
  { id: "e_deed", fact: "f_lands", name: "the deed of the church lands", holder: "hubert" },
  { id: "e_orders", fact: "f_mutiny", name: "the General's marching orders", holder: "varric" },
  { id: "e_register", fact: "f_forgery", name: "the altered chancery register", holder: "hubert" },
];

export const watchers: Record<string, string> = {
  godfrey: "host:king",
  wenna: "host:queen",
  brand: "access",
  tam: "random:2",
};

/** 最初から支持が公に知られている人。それ以外の支持は、各人が観察から推測する */
export const publicStance = [
  "edmund",
  "cedric",
  "theodric",
  "rowan",
  "lysander",
  "isolde",
  "queen",
  "varric",
  "anselm",
];

// 当事者（parties）は自動で加わるので、ここには当事者以外を書く。定義は docs/scandals.md
export const initialKnownKnowers: Record<string, Record<string, string[]>> = {
  edmund: { f_debt: ["rowan"], f_brawl: ["rowan"], f_army: ["rowan"] },
  rowan: {},
  brand: { f_brawl: ["rowan"] },
  varric: { f_army: ["rowan"], f_mutiny: ["rowan"] },
  petra: { f_smuggling: ["isolde"], f_lands: ["hubert"] },
  isolde: { f_letters: ["queen"], f_smuggling: [] },
  queen: { f_letters: ["isolde"], f_parentage: ["orlin"] },
  theodric: { f_letters: ["isolde", "queen"], f_smuggling: ["isolde"] },
  orlin: {},
  hubert: { f_skim: ["petra"], f_lands: [] },
  anselm: { f_lands: ["hubert"] },
  cedric: { f_courtship: ["lysander"] },
  lysander: { f_forgery: ["hubert"] },
  godfrey: { f_month: ["orlin"] },
};

/** 誰が初期状態でどの事実を知っているか */
export const initialKnowledge: Record<string, string[]> = {
  edmund: ["f_debt", "f_brawl", "f_army"],
  rowan: ["f_debt", "f_brawl", "f_army", "f_mutiny"],
  brand: ["f_brawl", "f_crest"],
  varric: ["f_army", "f_mutiny"],
  petra: ["f_debt", "f_skim", "f_smuggling", "f_lands"],
  theodric: ["f_letters", "f_crest", "f_smuggling"],
  isolde: ["f_letters", "f_bribe", "f_smuggling"],
  queen: ["f_letters", "f_parentage"],
  orlin: ["f_bribe", "f_parentage", "f_month"],
  tam: ["f_crest"],
  cedric: ["f_courtship", "f_doubt"],
  lysander: ["f_courtship", "f_forgery"],
  wenna: ["f_courtship"],
  hubert: ["f_skim", "f_lands", "f_forgery", "f_smuggling"],
  anselm: ["f_doubt", "f_lands"],
  godfrey: ["f_month"],
  king: ["f_month"],
};

/** 初期の支持 */
export const initialSupport: Record<string, Mind["support"]> = {
  edmund: "edmund",
  rowan: "edmund",
  varric: "edmund",
  brand: "edmund",
  cedric: "cedric",
  lysander: "cedric",
  anselm: "cedric",
  hubert: "cedric",
  theodric: "theodric",
  isolde: "theodric",
  queen: "theodric",
  orlin: "theodric",
  petra: "theodric",
  wenna: "cedric",
};

/** 初期の信頼 0..4。書かれていない組は 2（neutral） */
export const initialTrust: Record<string, Record<string, number>> = {
  king: {
    godfrey: 4,
    orlin: 3,
    hubert: 3,
    queen: 2,
    edmund: 2,
    cedric: 3,
    theodric: 2,
    varric: 3,
    anselm: 3,
  },
  edmund: { rowan: 4, varric: 4, cedric: 2, theodric: 1, isolde: 0, petra: 1 },
  cedric: { lysander: 4, anselm: 3, wenna: 3, theodric: 1, isolde: 0, edmund: 2 },
  theodric: { isolde: 4, queen: 4, petra: 3, edmund: 1, cedric: 1, anselm: 1 },
  rowan: { edmund: 4, brand: 3, varric: 3, isolde: 0, lysander: 1 },
  lysander: { cedric: 4, hubert: 2, wenna: 2, isolde: 0, rowan: 1 },
  isolde: { theodric: 4, queen: 4, orlin: 3, petra: 3, rowan: 0, lysander: 0 },
  queen: { theodric: 4, isolde: 3, wenna: 2, edmund: 0, cedric: 1 },
  orlin: { isolde: 3, king: 3 },
  hubert: { petra: 1, cedric: 3, edmund: 1 },
  godfrey: { king: 4, tam: 2, orlin: 3 },
  varric: { edmund: 4, rowan: 4, theodric: 0, isolde: 0 },
  anselm: { cedric: 3, theodric: 0, lysander: 2 },
  petra: { hubert: 1, isolde: 3, edmund: 1 },
  brand: { rowan: 4, isolde: 0 },
  tam: { wenna: 4, godfrey: 3 },
  wenna: { tam: 3, cedric: 4, queen: 2, isolde: 1 },
};
