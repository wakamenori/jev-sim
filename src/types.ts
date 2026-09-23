export type Id = string;

export interface Person {
  id: Id;
  name: string;
  role: string;
  /** 公開属性。誰でも知っている評判・立場・性格 */
  publicTraits: string;
  /** 隠し属性。本人だけが知る欲求・恐怖・秘密 */
  hiddenTraits: string;
  goals: string;
  accessToKing: boolean;
  candidate?: boolean;
  advisorOf?: Id;
  protagonist?: boolean;
}

export interface Fact {
  id: Id;
  text: string;
  /** その事実が関わる人。知っているとは限らない */
  about: Id[];
  /** 当事者。文面から「この人は知っているはず」と分かる人 */
  parties: Id[];
  /** 暴かれて困る人。脅しの材料になるのは、この人に対してだけ。自陣営の弱みの判定にも使う */
  harms: Id[];
}

export interface Knowledge {
  factId: Id;
  /** その事実が真だとどれだけ信じているか 0..1 */
  belief: number;
  source: Id | "self";
  /** 出所の出所。source がその事実を誰から聞いたか */
  via?: Id | "self";
  day: number;
  /** この事実を知った出来事（hear）。伝えるときの因果の鎖をつなぐ */
  eventId?: number;
}

/** 他人から受けた働きかけ。直近の記憶とは別に、判断材料として残す */
export interface Testimony {
  day: number;
  from: Id;
  kind: "claim" | "urge" | "request" | "threat" | "silence" | "accusation" | "sighting";
  /** claim / request / threat / silence / accusation なら事実、urge なら候補 */
  about: Id;
  /** threat で要求された支持先 */
  candidate?: Id;
  /** request / threat / silence に応じたか */
  agreed?: boolean;
  eventId: number;
}

export interface Mind {
  knowledge: Knowledge[];
  /** 相手ごとの信頼 0..4（distrust .. fully trusting） */
  trust: Record<Id, number>;
  support: Id | "undecided";
  /** 各候補を後継者としてどう見ているか 0..4（unfit .. the best choice） */
  opinions: Record<Id, number>;
  testimony: Testimony[];
  /** 自分がとった行動と、そのとき見えた相手の反応（英語。state に載せる） */
  actionLog: { day: number; turn: number; action: string; outcome: string }[];
  /** 自分が頼んだこと（依頼・口止め）と、その返事 */
  commitments: { day: number; kind: "request" | "silence"; to: Id; fact: Id; agreed: boolean }[];
  /** 事実ごとに「知っていると分かっている人」。推測は含めない */
  knownKnowers: Record<Id, Id[]>;
  /** 本人が見聞きした最近の出来事（英語、Jev に渡す） */
  recent: string[];
  /** 支持の性質。仕える（候補本人と側近）／傾く／恐れて従う／どこにも属さない */
  allegiance: Allegiance;
  /** 恐れて従っているとき、誰のどの弱みによるか */
  coercedBy?: { by: Id; fact: Id; day: number; previousSupport: Id | "undecided" };
  /** 目撃したこと: 誰が誰を訪ねたか */
  sightings: Sighting[];
  /** 他人についての推測（誰の支持者か）。コードの確実な規則と、毎日の個人の整理（Luna）で更新 */
  beliefs: Record<Id, BeliefAboutPerson>;
  /** 個人の整理で決めた、その日の自分の狙いと打ちたい手 */
  intention?: { day: number; aims: string[]; moves: { action: string; purpose: string }[] };
  /** 頭目として受け取った報告（陣営の頭目だけが使う） */
  reports: { day: number; from: Id; lines: string[] }[];
  /** 他人の脅しの信用（自分が知っている範囲）。実行した回数と、期限を過ぎて見逃した回数 */
  reputations: Record<Id, { kept: number; lapsed: number }>;
  /** 証拠を誰が持っていると思っているか（自分が見聞きした範囲） */
  knownHolders: Record<Id, Id>;
}

/** 証拠。事実ごとに 1 つ、持ち主のいる物。holder が undefined なら処分された */
export interface Evidence {
  id: Id;
  fact: Id;
  name: string;
  holder?: Id;
}

/**
 * 脅しの経路。king = 王に伝える、court = 宮廷で告発する、それ以外 = その人に伝える
 */
export type ThreatChannel = "king" | "court" | Id;

export interface Threat {
  /** 脅しの出来事の id */
  id: number;
  day: number;
  from: Id;
  to: Id;
  fact: Id;
  /** 要求した支持先 */
  candidate: Id;
  /** 証拠を渡せという脅しなら、その証拠 */
  demandEvidence?: Id;
  channel: ThreatChannel;
  /** この日の終わりまでに実行しなければ失効する */
  deadline: number;
  /**
   * complied = 屈した / refused = 拒まれ、実行するか決める段階 / carried = 実行した / lapsed = 見逃した（失効）
   * deterrent = 脅し返し。相手が先に暴いたら、こちらも暴ける
   * moot = 弱みが別の経路で暴かれ、脅しが意味を失った
   */
  status: "complied" | "refused" | "carried" | "lapsed" | "deterrent" | "moot";
}

export type Allegiance = "sworn" | "leaning" | "coerced" | "independent";

export interface Sighting {
  day: number;
  turn: number;
  visitor: Id;
  host: Id;
  /** 自分で見たなら self、人から聞いたならその人 */
  source: Id | "self";
}

export interface BeliefAboutPerson {
  /** その人が支持していると思う候補。unknown は分からない */
  support: Id | "undecided" | "unknown";
  /** 推測の根拠（英語、短く） */
  note: string;
  day: number;
}

export interface Event {
  id: number;
  day: number;
  /** 1 日の中のターン（1..TURNS）。日の終わりの処理は 0 */
  turn?: number;
  actor: Id;
  kind: string;
  target?: Id;
  factId?: Id;
  /** 年代記に出す日本語 */
  text: string;
  /** 引き金になった Event の id */
  causes: number[];
  /** Jev の分布など、追跡用の生データ */
  data?: unknown;
}

/** ある日の終わりの各人の内面。day 0 は初期状態 */
export interface Snapshot {
  day: number;
  minds: Record<
    Id,
    Pick<Mind, "support" | "trust" | "knowledge" | "opinions" | "knownKnowers"> &
      Partial<Pick<Mind, "beliefs" | "allegiance">>
  >;
}

/** 介入：ある日のある人の判断を、Jev の答えに関係なく指定の値に固定する */
export interface Override {
  day: number;
  /** 省略時はその日の全ターン（support）/ 1 ターン目（action） */
  turn?: number;
  actor: Id;
  field: "action" | "support";
  /** action なら行動の鍵（例 tell:hubert:f_skim） */
  value: string;
}

export interface RunMeta {
  overrides?: Override[];
  /** 介入実行の元になった実行（ファイル名） */
  forkOf?: string;
  model: string;
  startedAt: string;
  finishedAt?: string;
  jev?: { calls: number; cacheHits: number; retries: number; inputTokens: number };
}

export interface World {
  meta?: RunMeta;
  day: number;
  totalDays: number;
  people: Record<Id, Person>;
  minds: Record<Id, Mind>;
  facts: Record<Id, Fact>;
  events: Event[];
  /** 王が見た各候補の適性 0..4 の推移 */
  kingSuitability: Record<Id, number>[];
  snapshots: Snapshot[];
  /** 今のターン */
  turn: number;
  /** 宮廷で公に告発された事実 */
  publicFacts: Id[];
  /** 引き受けた依頼。強制はせず、本人の選択肢に「約束した」の印として付く。翌日の終わりで失効 */
  pending: {
    actor: Id;
    action: string;
    requestEventId: number;
    from: Id;
    day: number;
    /** request = 引き受けた依頼 / order = 脅しに屈した相手からの命令 */
    kind?: "request" | "order";
  }[];
  /** 陣営の参謀が立てた計画。日ごと */
  plans: FactionPlan[];
  /** 脅しの記録 */
  threats: Threat[];
  /** 暴かれた結果が既に起きた事実 */
  exposed: Id[];
  /** 証拠と、その今の持ち主 */
  evidence: Record<Id, Evidence>;
}

/** 秘密が暴かれた（公に告発された、または王が信じた）ときに起きること。事実ごとに人物設定で定める */
export interface ExposureEffect {
  /** 宮廷に広まる説明（英語、state に載せる） */
  text: string;
  /** 王に会えなくなる人 */
  loseAccess?: Id[];
  /** 王に会えるようになる人 */
  gainAccess?: Id[];
  /** 候補の評価が動く人 */
  opinionShift?: { who: Id; candidate: Id; delta: number }[];
  /** 王宮の全員の、その人への信頼が動く */
  trustShift?: { about: Id; delta: number }[];
}

export interface PlannedMove {
  day: number;
  actor: Id;
  /** 行動の鍵。Jev の選択肢の鍵と同じ形 */
  action: string;
  purpose: string;
}

export interface FactionPlan {
  day: number;
  faction: Id;
  lead: Id;
  model: string;
  assessment: string;
  aims: string[];
  moves: PlannedMove[];
  rejected: { move: PlannedMove; reason: string }[];
}
