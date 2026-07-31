# acyclic-eval

Judge自身に依存せずに生成した mutation case で、LLM またはルールベースの
Judge を評価する TypeScript フレームワークです。

[English README](./README.md) | [npm](https://www.npmjs.com/package/acyclic-eval) | [MIT](./LICENSE)

<!-- docs-sync: 2026-08-01 -->

`acyclic-eval` は、AI支援開発を計測可能・検証可能・レビュー可能にする
ローカルファーストなツール群のうち、**Judgeを評価する層**です。完成済みの
汎用評価器や、一般的な精度を主張するベンチマークではありません。利用者が
Judgeとは独立に定義した corpus・構造的 mutation・期待値を用意し、記録済みの
Judge出力を比較します。

バンドルされたデモは資格情報不要で、インストール後にネットワークアクセスを
行いません。フレームワークはテレメトリーを追加せず、artifact を外部送信しません。
外部通信の有無は、利用者が実装する Judge によって決まります。

## 何を解決するか

Judge（または同じ上流パイプライン）が「どの case を評価対象にするか」と
「その case の正しさ」の両方に影響すると、Judgeの不具合が発見すべき case を
除外できます。acyclic-eval は generation・judgement・comparison を分離し、
得られた pass rate の範囲を確認可能にします。

```text
corpus + MutationOperator ──generate──> manifest + artifacts
                                             │
                                          Judge
                                             │
                                     observations.jsonl
                                             │
                                       Comparator ──score──> report
```

## Quick start

Node.js 18 以降が必要です。次の npm release を準備中のため、現時点で直ちに
再現できる導線は source checkout です。

```bash
git clone https://github.com/shiki-yusuke/acyclic-eval.git
cd acyclic-eval
npm ci
npm run demo
```

`npm run demo` は一時ディレクトリを作成・削除します。3種の mutation operator を
持つ自己完結のルールベース transcript Judge を実行し、`npm ci` 後は資格情報も
ネットワークも必要としません。

### パッケージ版 Quick start（次の npm release 向け）

次の手順は、この checkout から作った tarball で検証済みです。検証時点の公開済み
`latest` は `0.1.3` で、npm bin の symlink 経由でCLIが実行されない不具合がありました。
修正はこの checkout にありますが、まだ公開していません。新しい version を公開する
までは、次を現在の registry 導線として案内しないでください。

```bash
npm install acyclic-eval
npx acyclic-eval generate --config ./node_modules/acyclic-eval/dist/examples/toy/config.js --out ./acyclic-eval-out
npx acyclic-eval evaluate --config ./node_modules/acyclic-eval/dist/examples/toy/config.js --out ./acyclic-eval-out --samples 1
npx acyclic-eval score --config ./node_modules/acyclic-eval/dist/examples/toy/config.js --out ./acyclic-eval-out --min-coverage 1
```

## 期待する出力

```text
generated 9 case(s) into ./acyclic-eval-out
"okSamples": 9
- overall: 9/9 passed (100.0%), 0 infra errors, 9 total cases
- gate: PASS
```

完全な再生成手順と、可変の日時を伏せた出力は [docs/demo.md](./docs/demo.md) を
参照してください。

## 利用すべき場合／利用すべきでない場合

Judgeから独立に、構造的に妥当な mutation と期待値を定義できる場合に使います。
決定的なルール、ローカルモデル、ホスト型モデルの adapter に利用できます。

人間の gold label の代替、意味的正しさの証明、汎用 benchmark には向きません。
期待値を評価対象 Judge 自身が決めている場合、または operator を Judge から独立
させられない場合にも使えません。

## 評価結果の読み方

toy の 9/9 はデモ用コーパスだけの再現結果です。`0.1.0` で記録された evigate
adapter の 113 case / 8 operator 比較は、特定コーパスにおける旧実装との
case-by-case parity を示すもので、evigate や LLM 一般の精度は示しません。M4 は
その比較で 0/0 coverage でした。件数・対象・限界は
[evaluation](./docs/evaluation.md) を参照してください。

## 詳細ドキュメント

- [Concepts](./docs/concepts.md)
- [Architecture](./docs/architecture.md)
- [Evaluation](./docs/evaluation.md)
- [Threat model](./docs/threat-model.md)
- [Limitations](./docs/limitations.md)
- [Security](./docs/security.md)
- [Development](./docs/development.md)
- [Roadmap](./docs/roadmap.md)

Issue やPRには、未加工の transcript、prompt、コマンド出力、資格情報、ローカル
パスを投稿しないでください。報告方法は [SECURITY.md](./SECURITY.md)、貢献手順は
[CONTRIBUTING.md](./CONTRIBUTING.md) を参照してください。

## Related projects

- [**evigate**](https://github.com/shiki-yusuke/evigate) — AI coding agent の
  完了申告を実行証拠と照合します。
- [**agent-cost**](https://github.com/shiki-yusuke/agent-cost) — Claude Code と
  Codex CLI の token 使用量と推定コストを可視化します。
- [**spec-lane**](https://github.com/shiki-yusuke/lane) — Intent から検証・人間の
  判断ゲートまでを管理します。

各ツールは独立して利用できます。組み合わせる場合は、コスト計測、申告検証、
検証器の評価、delivery workflow、skillの再利用という Evidence-First AI Coding
Toolkit の流れを構成します。

## License

[MIT](./LICENSE)
