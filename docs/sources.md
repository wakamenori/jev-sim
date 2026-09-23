# 出典と確認範囲

確認日：2026年9月23日。技術仕様は提供元の公式資料を優先しました。以下のリンクは継続更新される可能性があります。

## 製品・仕様の一次資料

| 出典 | 本調査で確認した内容 |
| --- | --- |
| [TypeSafe AI：公式発表](https://typesafe.ai/blog/introducing-system-one-models-and-jev)（2026-09-15） | 発表日、早期アクセス、RLCD、並列処理、性能比較の方法と留保 |
| [Introduction](https://docs.typesafe.ai/introduction) | 入出力の考え方、独立した問いをコードで組み合わせる構成 |
| [Choice](https://docs.typesafe.ai/primitives/choice) | 選択、候補ごとの確率、255候補の上限 |
| [Score](https://docs.typesafe.ai/primitives/score) | 評価尺度、2〜10段階、確率加重平均の意味 |
| [Noul](https://docs.typesafe.ai/primitives/noul) | 真偽を0〜1で扱うプリミティブ |
| [Confidence](https://docs.typesafe.ai/confidence) | 確率分布から導く確信度、しきい値の調整 |
| [Models](https://docs.typesafe.ai/models) | 現行ID、価格、入力、コンテキスト、レート制限、言語、顧客データの扱い |
| [Jev 1.13 jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13)（ページ内最終確認日：2026-09-17） | 数値、長い入力、敵対的入力、別々の問いの不整合、文章生成の制約 |
| [API reference](https://docs.typesafe.ai/api) | エンドポイント、リクエストのフィールド、問いのキーの扱い |
| [Quick start](https://docs.typesafe.ai/introduction/quickstart) | Playground、APIキー、SDKによる開始方法 |
| [ドキュメント索引](https://docs.typesafe.ai/llms.txt) | 出典探索、引用確認・ガードレール・候補抽出などの公式利用例の所在 |

## 公開例・評価

| 出典 | 確認範囲と留意点 |
| --- | --- |
| [Function calling](https://docs.typesafe.ai/cookbooks/function_calling) | 固定候補の引数を関数へ渡す例。掲載コードは `jev-1.12` |
| [Re-ranking](https://docs.typesafe.ai/cookbooks/rerank_typesafe) | CLERCを用いた小規模な公式例。掲載コードは `jev-1.12`。再実行はしていない |
| [Workflow evals](https://evals.typesafe.ai/) | 提供元の評価サイト。評価方法の説明は公式発表で確認。独立した再現評価はしていない |
| [Calibrated Decisions at Scale](https://arxiv.org/abs/2609.24052)（2026-09-21、v1） | 著者：Amir Rafe、Subasish Das。研究者による一次報告。今回の確認は要旨と書誌情報まで。査読状況や本文の詳細条件、再現性は未確認 |

## 情報の扱い

公式仕様、提供元が主張する性能、研究者の報告、調査者の解釈を区別しました。非公式の解説サイトや報道は対象特定の手がかりに使い、技術仕様の根拠には採用していません。

API呼び出し、SDK導入、性能測定は行っていません。出典に書かれた数字を、本リポジトリで測定した結果として扱わないでください。
