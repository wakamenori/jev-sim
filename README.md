# Jev Court Simulation

王位継承を巡る宮廷のシミュレーション。各人物の行動と反応をJev、陣営の計画と日末の個人の整理を汎用LLMで判断します。現在はNPCによる自動進行と、実行結果を読むviewerがあります。人間が行動を選ぶプレイヤー操作は未実装です。

## 準備

Node.js 22.15以上とpnpmを使います。TypeScriptはNodeの型除去で実行し、型検査は別に行います。Node 22では実験機能の通知が出ます。

```sh
pnpm install --frozen-lockfile
pnpm verify
```

`verify`はlint・型検査・自動テスト・生成資料の整合・viewerの描画とビルドを確認します。APIキーと手元の実行ログは不要です。

## 通常実行

リポジトリのルートで実行します。AI Gatewayの認証を`.env`に設定してください（`AI_GATEWAY_API_KEY`）。`.env`、`cache/`、`out/`はGit管理対象外です。

```sh
pnpm baseline --until 2 --verbose
pnpm baseline
pnpm viewer
```

`--until`を省略すると最終日まで進行して王が後継者を指名します。実行結果は`out/runs/*.json`へ保存します。viewerでは保存ログを選ぶか、JSONファイルを読み込みます。開発用の全体表示と、Lysanderの認識に絞った表示があります。

通常の端末表示は開始・日末・終了に絞っています。実行中は開始時に表示される`out/logs/<run-id>/status.json`で状況を確認し、再試行やエラーの詳細は同じ場所の`events.jsonl`を読みます。失敗・中断時の状態も保存します。[実行ログの読み方](docs/runtime-logging.md)を参照してください。

モデル設定はJevが`src/jev.ts`、汎用LLMが`src/generation.ts`にあります。汎用LLMの推論設定は`LLM_EFFORT`で変更できます。

## 開発

| コマンド | 内容 |
| --- | --- |
| `pnpm lint` | Biomeと本体・検証・viewerの型検査。書き換えなし |
| `pnpm check` | Biomeの自動修正と型検査 |
| `pnpm test` | 通信しない自動テスト |
| `pnpm test:coverage` | 自動テストのカバレッジ表示 |
| `pnpm viewer:smoke` | 固定回答で生成した世界をSSR描画 |
| `pnpm viewer:smoke <run.json>` | 既存ログの描画互換性を確認 |
| `pnpm viewer:build` | viewerのビルド |
| `pnpm docs:generate` | シナリオ資料をコードの定義から生成 |
| `pnpm docs:check` | 生成資料が定義と一致するか確認 |

viewerの描画検証はマークアップ生成を確認します。ブラウザー操作や見た目の検証は含みません。viewerのビルドには手元の`out/runs`も含まれるため、大きなログがあればチャンクサイズの警告が出ます。

## 本体と検証の配置

- `src/`：通常のシミュレーション、モデル接続、実行・保存
- `viewer/src/`：実行結果の表示
- `tests/`：固定回答と自動テスト
- `experiments/`：判断の介入、実行比較、実モデルの評価
- `scripts/analysis/`：保存ログや初期状態の分析
- `scripts/docs/`：コードの定義から資料を生成

本体から検証コードへの依存は禁止し、自動テストで確認します。詳しくは[構造と処理順](docs/architecture.md)、[検証方法](docs/testing.md)、[資料一覧](docs/README.md)を参照してください。
