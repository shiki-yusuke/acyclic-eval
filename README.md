# acyclic-eval

A mutation-based evaluation framework for measuring a judge's (LLM- or
rule-based) accuracy without depending on the judge itself.

> **Status: `0.1.0` (stable, on npm as `acyclic-eval`).** Phase 1 (framework + a self-contained toy
> example) plus Phase 2 (a real-world adapter -- [evigate](https://github.com/shiki-yusuke/evigate)'s
> mutation harness now runs on this framework, verified via a case-for-case
> shadow-run comparison against its pre-adapter implementation; see
> [CHANGELOG.md](./CHANGELOG.md) for the API changes that adapter needed:
> async `selfValidate`, judge-identity-aware resume, a per-operator gate,
> manifest reader defenses). evigate's adapter is merged and live on its
> `main` branch.

## Why acyclic?

Most "let's grade our classifier" setups have a hidden dependency: the same
logic (or the same upstream pipeline) that produced the classifier also
decided what the test cases look like, or which ones "count." If the
classifier has a bug, that bug can quietly disqualify the very test cases
that would have exposed it — and a clean scorecard stops meaning anything.

This isn't hypothetical. It's the exact failure this project generalizes from:
an earlier mutation-testing harness (part of
[evigate](https://github.com/shiki-yusuke/evigate), a different,
evidence-verification tool) used the detector under evaluation both to *pick
which cases to mutate* and to *decide whether a generated mutant was valid*. A bug in the detector
could silently exclude mutants that would have revealed it — so a 100% match
rate on that harness didn't actually mean 100% accuracy. Fixing that required
redesigning generation so the detector is never consulted during mutant
creation or acceptance, only afterward, by a separate scoring step. See
[Threat model](./docs/threat-model.md) for the full writeup, including where
this guarantee runs out.

`acyclic-eval` packages that redesign as a reusable, domain-agnostic
framework: generate mutated test cases from a corpus using only structural
information (never the judge), evaluate the judge against them, and score the
result with a comparator that can be swapped and re-run without touching the
judge again.

## Quick start

Install from npm, or run the example from a local checkout:

```bash
npm install acyclic-eval        # library / CLI (0.1.0)

# or, to run the bundled toy example end to end:
git clone https://github.com/shiki-yusuke/acyclic-eval.git
cd acyclic-eval
npm install
npm run build
npm run example
```

`npm run example` runs the self-contained toy domain end to end
(`examples/toy/`): a tiny rule-based "did the tests pass" judge, three
mutation operators, generate → evaluate → score, and a printed Markdown
report. Read `examples/toy/operators.ts` and `examples/toy/judge.ts` first —
they're the fastest way to see the three-role split in a domain small enough
to hold in your head.

Using the CLI directly against the same example (after `npm run build`):

```bash
node dist/src/cli.js generate --config dist/examples/toy/config.js --out ./out
node dist/src/cli.js evaluate --config dist/examples/toy/config.js --out ./out --samples 1
node dist/src/cli.js score    --config dist/examples/toy/config.js --out ./out --min-coverage 1
```

(`npm link` first if you want a bare `acyclic-eval` command on your `PATH`.)

`generate` and `evaluate` are separate subcommands on purpose — see
[Threat model](./docs/threat-model.md) for why running them as separate
processes is the recommended setup, not just an implementation detail. This
is also why the config module exports three separate functions
(`generateConfig()` / `evaluateConfig()` / `scoreConfig()`, see
`examples/toy/config.ts`) instead of one flat object: `generate` only ever
calls `generateConfig()`, so a judge module that `evaluateConfig()` loads via
its own `import()` is never touched by the `generate` code path at all.

`evaluate` is safe to re-run: `resume` (on by default) skips samples that
already have a recorded observation, re-runs any whose case content has
changed since that observation was recorded (reported as
`staleObservationsInvalidated`), and tolerates a torn trailing line left by a
process killed mid-write (repairing the file rather than choking on it) --
anything else wrong with `observations.jsonl` is a hard error, not a silent
skip.

## Concepts

Three roles, kept structurally apart:

| Role | Sees | Never sees |
|---|---|---|
| `MutationOperator` | the source corpus, structural anchors it derives itself | the `Judge`, its output, or any evaluation result |
| `Judge` | one `TCaseInput` at a time, plus `{ signal, sampleIndex }` | `expected`, `target`, `operatorId`, `tags` — nothing about what answer is "correct" |
| `Comparator` | `(expected, actual)` after the fact | the corpus, the operator, or the judge's internals |

Pipeline: `generate(corpus, operators) → manifest` (JSON-compatible,
content-addressed) → `evaluate(manifest, judge) → observations.jsonl` (raw
judge output, one line per (case, sample)) → `score(observations, comparator)
→ report`. Re-running `score` with a different `comparator` re-grades the
exact same observations without calling the judge again.

`evaluate`'s `timeoutMs` hands your judge an `AbortSignal` but can't force it
to actually stop -- a judge that ignores `ctx.signal` keeps running in the
background after the timeout is recorded, which can push real concurrency
above the configured limit. `runner.ts` logs a warning and exposes
`getLeakedInFlightCount()` when this happens; see
[docs/threat-model.md](./docs/threat-model.md#timeouts-assume-cooperation-non-cooperative-abort).

### Designing operators: recall side vs. precision side

- **Recall-side operators** remove or corrupt the evidence a correct verdict
  should depend on. The judge must *not* still produce the original
  (now-unsupported) answer. Express this with `forbid` or a narrow `oneOf`.
- **Precision-side operators** add irrelevant noise (an unrelated failure, an
  earlier/unrelated event) that a correct judge should ignore. The judge
  *must* still produce the original answer. Express this with `equals`.

A useful pass/fail definition needs both: recall-only operators can be
gamed by a judge that always answers "unknown"; precision-only operators
can be gamed by one that always answers the "safe" default.

### Setting a pass bar

`score()` never hardcodes what "good" means:

- No `MetricAdapter` → plain pass/fail counts and rates only.
- A `MetricAdapter` → domain-defined positive class + confusion matrix
  (precision/recall), computed the same way you'd define it, not a guess by
  the framework.
- `minCoverage` / `minPassRate` in `ScoreOptions` turn "an operator got zero
  coverage" or "the pass rate is below X" into a failing `report.pass`,
  instead of a warning that's easy to miss in a wall of green.
- `allowZeroGenerated` is the per-operator version of the same idea:
  `minCoverage`'s aggregate ratio can average away one operator that's
  consistently at zero coverage (e.g. a fail-then-retry pattern a given
  corpus never happens to contain). Listing that operator explicitly in
  `allowZeroGenerated` says so on purpose; any *other* zero-coverage operator
  still fails the gate.

## Threat model

Non-circularity is enforced by the type system and process separation, not
by convention alone — and it has real limits (closure capture, judge-derived
corpora). Read [docs/threat-model.md](./docs/threat-model.md) before relying
on a number this framework produces, especially the section on **what counts
as "the judge"** if you're adapting this to claim/verdict-style domains.

## Evaluation methodology this project inherited — and now drives directly

`acyclic-eval`'s design started out extracted *from* the mutation-testing
harness in [evigate](https://github.com/shiki-yusuke/evigate), a local CLI
that verifies AI coding agents' "done" claims against execution evidence.
As of Phase 2, that relationship has flipped: evigate's harness
(`src/eval-adapters/` in evigate's repo, on its `acyclic-eval-adapter`
branch) is now the first real adapter *built on* `acyclic-eval` --
`evigate mutate` calls this package's `generate()` with eight
`MutationOperator` implementations (M1-M8), and `evigate eval --mutations`
calls `evaluate()`/`score()` against a detector-only `Judge` and an
exact-match `Comparator`. The pre-adapter implementation (its own
generate/evaluate/select logic, independent of this package) was deleted
only after a case-for-case shadow-run comparison against it passed cleanly:

**113/113 (100%) operator-level match rate, with the M4 operator at 0/0**
(M1=3, M2=4, M3=19, M4=0, M5=19, M6=3, M7=51, M8=14 -- the corpus it drew
from happened to contain no natural occurrence of the structural pattern M4
targets, not a failure, just zero coverage, exactly the kind of thing
`score()`'s coverage warnings exist to surface honestly).

**This is now a result `acyclic-eval` itself produces**, via evigate's
adapter -- not merely a number inherited from a separate, pre-`acyclic-eval`
implementation (which is what this section described before Phase 2, and
still an accurate description of *why* the M1-M8 design looks the way it
does). `acyclic-eval`'s own toy example passes 9/9 (see `npm run example`),
which remains a demonstration corpus, not a benchmark claim -- the 113/113
result above is the real one.

## Roadmap

- **Phase 2 (complete):** the evigate adapter described above.
  `0.1.0-alpha.2`'s API changes (async `selfValidate`, judge-identity-aware
  resume, `allowZeroGenerated`, manifest reader defenses) were driven by
  that adapter's real requirements -- see [CHANGELOG.md](./CHANGELOG.md).
- **Released:** `0.1.0` is on npm as `acyclic-eval`, and evigate's adapter
  is merged and live on its `main` branch.
- Beyond that: additional example domains beyond the toy corpus (the toy's
  9/9 is a demonstration, not a real-world result -- the real-world
  validation is the evigate 113/113 above).

## License

MIT — see [LICENSE](./LICENSE).

---

## 日本語サマリ

`acyclic-eval` は、LLM またはルールベースの判定器（judge）の精度を、**判定器自身に
依存せず（非循環に）**測定するための mutation 評価フレームワークです。

判定器の精度を測る仕組みが、判定器自身（あるいはそれと同じパイプライン）に依存して
「何を正解とするか」を決めていると、判定器にバグがあった場合にそのバグを暴くはずの
テストケース自体が静かに排除されてしまい、見かけ上の高い一致率が意味を持たなくなり
ます。本プロジェクトはまさにこの失敗を経験した設計（[evigate](https://github.com/shiki-yusuke/evigate)
向けの mutation ハーネス）を一般化したものです。詳細は
[docs/threat-model.md](./docs/threat-model.md) を参照してください。

設計の核は3つの役割の構造的分離です。`MutationOperator`（コーパスから構造的情報のみ
で mutant を生成。judge を一切参照できない）、`Judge`（評価対象そのもの。入力ケース
以外は何も渡されない — 期待値も分からない）、`Comparator`（生成後に突合するだけで、
判定器を再実行せず再採点できる）。

`npm install && npm run build && npm run example` で、evigate 非依存の自己完結
toy ドメイン（簡易ルールベース判定器 + 3種のオペレータ）が generate → evaluate →
score まで一気通貫で動作し、Markdown レポートが出力されます。

現時点は Phase 1（フレームワーク本体 + toy example）+ Phase 2（evigate adapter）が完了した
npm 未公開のアルファ版です。README 中の「113/113」は、当初は本プロジェクトの設計源流と
なった **[evigate](https://github.com/shiki-yusuke/evigate) 自身の**実績でしたが、
Phase 2 で evigate の mutation harness（`src/eval-adapters/`）自体を `acyclic-eval` の
adapter として繋ぎ込んだことで、**現在は `acyclic-eval` 自身が生成する結果**になりました
（旧実装は、その adapter とのケース単位 shadow-run 比較が一致することを確認したうえで
削除済み）。`acyclic-eval` 自身の toy example は 9/9 で、これは実績値ではなく
デモンストレーション用のコーパスです。evigate の adapter ブランチはまだ push していません。
