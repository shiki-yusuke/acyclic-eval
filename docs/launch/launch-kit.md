# Launch kit — acyclic-eval

Use one channel and one clear request for feedback at a time. Check the linked
README and current package version before posting. The 9/9 toy result is a
reproducibility demo; the documented 113-case evigate result is adapter parity
for one corpus, not a general accuracy claim.

## 日本語短文

### X

LLM Judge の評価で、Judge 自身が「どの失敗例を評価対象にするか」に影響すると、
不具合を見つけるはずの case が消えることがあります。`acyclic-eval` は mutation
生成・Judge・比較を分離し、記録済みの出力を再採点できる TypeScript framework です。
5分の toy demo と制約: https://github.com/shiki-yusuke/acyclic-eval

### Slack コミュニティ

AI Judge の pass rate をどこまで信頼できるか、という問題に取り組んでいます。
`acyclic-eval` は Judge を見ずに構造的 mutation case を生成し、Judge出力を後から
Comparator で照合します。現在の toy は9 caseの再現確認用で、精度ベンチマークでは
ありません。operator が Judge由来になっていないか、設計上の穴をぜひ指摘してください。
https://github.com/shiki-yusuke/acyclic-eval

### Zenn/Qiita 導入文

「LLM Judge の評価に、評価対象の Judge が少しでも混ざったら何が壊れるか」を出発点に、
mutation generation・judgement・comparison を分離する小さな TypeScript framework を
作りました。本稿ではスコアではなく、case の独立性、0 coverage、unknown、そして
人間の review gate をどう扱うかを扱います。

### GitHubプロフィールからの紹介文

`acyclic-eval` — Judge自身に依存しない mutation case で、AI Judge の評価範囲と
限界を検証可能にするフレームワーク。

## English short copy

### X

An LLM judge can quietly evade the cases that would expose its bugs when it
also influences which cases are admitted. `acyclic-eval` separates mutation
generation, judgement, and comparison, then lets you re-score recorded output.
The bundled 9-case demo is a pipeline check, not a benchmark:
https://github.com/shiki-yusuke/acyclic-eval

### LinkedIn

AI-assisted development needs evaluation evidence, not just a percentage.
`acyclic-eval` is a local-first TypeScript framework for evaluating a specific
LLM or rule-based judge with mutations generated independently of that judge.
It records observations for transparent re-scoring and documents where the
independence guarantee stops. I would value feedback on corpus provenance,
operator validity, and human review gates.
https://github.com/shiki-yusuke/acyclic-eval

### Reddit

When a classifier helps decide which mutation cases are valid, its failures can
remove the tests that would reveal them. I extracted a small TypeScript
framework that separates generator, judge, and comparator; `score` reuses
recorded observations instead of re-calling the judge. It includes a 9-case
rule-based demo and an explicit threat model. What failure modes would you add?
https://github.com/shiki-yusuke/acyclic-eval

### Hacker News

**Title:** Show HN: acyclic-eval – Evaluate a judge without self-influenced mutation cases

**Post:** A judge's reported score is hard to interpret if the same logic also
decides which test mutations count. acyclic-eval is a local-first TypeScript
framework that separates mutation generation, judgement, and comparison. It
records raw observations and re-scores them without another judge call. The
bundled 9-case example is only a reproducibility demo, and the threat model
calls out closure capture, judge-derived corpora, zero coverage, and
cooperative timeouts. I'd appreciate feedback on whether the boundary is useful
for real LLM-judge or rule-based evaluation setups.

https://github.com/shiki-yusuke/acyclic-eval
