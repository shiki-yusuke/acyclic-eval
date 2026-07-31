# Changelog

All notable changes to acyclic-eval are documented here. This project is
pre-1.0 (alpha); breaking changes between alpha releases are expected and
are not accompanied by a deprecation period.

## 0.1.1

Docs-only release: the README bundled with 0.1.0 predated the npm release
itself and still carried pre-release wording ("not yet published to npm",
"adapter branch not yet pushed"). No code changes.

## 0.1.0

Same API as 0.1.0-alpha.2, promoted to stable. Between alpha.2 and this release the framework
was dogfooded by refactoring [evigate](https://github.com/shiki-yusuke/evigate)'s built-in
mutation evaluation into acyclic-eval adapters (8 operators, a detector-only judge, and an
exact-match comparator). The full evigate corpus regression -- 113 cases across 8 operators,
compared case-by-case (target, expected label, artifact digest, actual verdict) against the
pre-refactor implementation -- passed 113/113, which is what qualifies this API as stable.

## 0.1.0-alpha.2

Not published to npm (tarball-only; `npm pack` produces the artifact used to
dogfood this release from a consuming project before it's published).

### Breaking changes

- **`generate()` is now `async`** and returns `Promise<GenerateResult>`. Every call site must
  `await` it.
- **`MutationOperator.selfValidate()` may now return `Promise<ValidationResult>`** in addition to
  a plain `ValidationResult`. `generate()` awaits it either way, so a synchronous implementation
  keeps working unchanged. This exists for operators whose structural self-check needs to re-parse
  mutated content through an async parser (e.g. to confirm a target claim/anchor is still
  extractable at the expected location after mutation).
- **`readObservations()`'s return shape changed in 0.1.0-alpha.1 already** (`Observation[]` ->
  `{ observations, tornTailDropped }`); this is called out here again as a reminder since
  alpha.1 was never published and some consumers may be on an even earlier local build.

### New: resume integrity checks

- `evaluate()`'s resume logic now also invalidates a recorded observation (treats it as stale,
  re-runs the case) when its `judgeId`/`judgeVersion` doesn't match the judge instance the current
  `evaluate()` call was given -- not just when the artifact's content digest doesn't match.
  `EvaluateSummary.staleObservationsInvalidated` now covers both causes.
- `score()` now throws `AcyclicEvalError` if `observations.jsonl` contains more than one distinct
  `judgeId`/`judgeVersion` identity. There is no override flag: scoring results from more than one
  judge as a single report would silently blend them, so this always errors -- split
  `observations.jsonl` by judge identity (or re-run `evaluate()` with `resume: false` against a
  single judge) before scoring.

### New: per-operator gate

- `ScoreOptions.allowZeroGenerated?: readonly string[]` -- when set (an empty array counts as
  set), any operator whose `structurallyValid` count is 0 and whose id is NOT in this list fails
  the gate (`report.pass = false`), regardless of `minCoverage`'s aggregate ratio. Use this to
  require every operator you expect coverage from to actually produce something, while explicitly
  tolerating specific operators that a given corpus is known not to exercise.

### New: manifest reader defenses

- `readManifest()` now rejects a legacy (pre-acyclic-eval) manifest format -- a bare JSON array of
  mutant entries, as produced by the mutation-testing harness this project's design was extracted
  from -- with a specific "incompatible legacy manifest format" error instead of the generic
  "not a JSON object" error a bare array previously produced.
- `readManifest()`/`readArtifact()` now reject any `artifactUri` that resolves outside `outDir`
  (`resolveArtifactPath()`, exported), whether from a hand-edited manifest, a buggy writer, or
  something adversarial. Checked both at manifest-load time (fail fast) and at artifact-read time
  (defense in depth, in case a `ManifestEntry` is constructed directly rather than via
  `readManifest()`).

## 0.1.0-alpha.1

Initial release, published to npm under the `next` dist-tag. Framework core (types, generate/evaluate/
score pipeline, CLI, toy example) plus the fixes from the first Codex implementation review round
(CLI config-loading separation, JSONL checkpoint/resume robustness, non-cooperative-abort tracking,
score-time artifact tamper verification, manifest `target` field validation, Windows-safe artifact
filenames).
