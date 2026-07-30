# Threat model: how acyclic-eval stays non-circular (and where it can't)

This document is the honest accounting promised in the README's "Threat model"
section. Read it before trusting a number this framework produces.

## What "circular evaluation" means here

A mutation-testing harness that measures a judge's accuracy is only useful if
the judge under test was never consulted while deciding *what counts as a
correct answer*. If it was — even indirectly — then a bug in the judge can
disqualify the very test cases that would have exposed it, and a 100% pass
rate stops meaning anything. This is not a hypothetical: it is the exact
failure mode that motivated this project (an earlier iteration of the
mutation harness this framework generalizes used the detector under test both
to pick which claims to mutate and to decide whether a generated mutant was
"valid" — a bug in the detector could quietly disqualify mutants that would
have exposed it).

## Layer 1: the type system makes direct injection impossible

- `MutationOperator.selectMaterials` / `.mutate` / `.selfValidate` never
  receive a `Judge` instance, and their return types never carry a `Judge`
  either. There is no parameter through which a judge (or its output) could
  flow into generation.
- `evaluate()` only ever hands a `Judge` the `TCaseInput` read back from the
  content-addressed artifact file. It never receives `expected`, `target`,
  `operatorId`, `tags`, or any other manifest metadata — so a judge cannot
  reverse-engineer "what answer is expected" from anything acyclic-eval
  passes it.

## Layer 2: process/entry-point separation

`generate` and `evaluate` are separate CLI subcommands, and the recommended
usage is to run them as **separate processes** (e.g. a CI job that runs
`generate` with no judge credentials at all, followed by a second job that
only has judge credentials and a read-only manifest). This isn't just a
suggestion in prose: the CLI's config-loading contract enforces it. A config
module exposes `generateConfig()` / `evaluateConfig()` / `scoreConfig()` as
separate functions (see `examples/toy/config.ts`), and each subcommand only
ever calls the one it needs. If `evaluateConfig()` does its own `import()` of
a judge module *inside* the function body (rather than the config module
statically importing it at the top level), then running `generate` never
loads that judge module into the process at all -- not "shares no data with
it," but never executes its code in the first place. A config module that
instead does `import { judge } from "./judge.js"` at its own top level
defeats this even if `generate`'s code path never reads the resulting
binding, because ES module evaluation runs a module's top-level code as soon
as anything imports it, regardless of which export is actually used
afterward.

The manifest's `artifactDigest`/`sourceDigest` fields, together with each
observation's `inputDigest`, let both `evaluate()` and `score()` detect if a
generated case was modified after the fact: `evaluate()` re-verifies
`artifactDigest` every time it reads an artifact to feed the judge (via
`readArtifact()`), and `score()` independently re-reads every evaluated
case's current artifact and refuses to score if its digest no longer matches
what the recorded observation says it evaluated -- not just at generation
time, but every time either command runs.

## Layer 3: re-scoring without re-running the judge

`score()` never calls a judge — it only reads `observations.jsonl` (the raw,
already-recorded judge outputs) and a `Comparator`. This means a comparator
bug can be fixed and the report regenerated for free, without touching the
(possibly expensive, possibly non-deterministic) judge calls at all — nothing
about re-scoring can smuggle judge behavior back into generation.

## Timeouts assume cooperation: non-cooperative abort

`evaluate()`'s `timeoutMs` option works by handing the judge an `AbortSignal`
(`ctx.signal`) and racing its call against a timer. If the timer wins, the
runner records a timeout failure and moves on -- but it cannot force the
judge's own call to actually stop. `ctx.signal` is advisory, exactly like
`AbortSignal` everywhere else on the platform: a judge implementation has to
check it (or pass it through to something that does, e.g. `fetch(url, {
signal })`) for the abort to have any real effect.

If a judge ignores `ctx.signal` entirely, its call keeps running in the
background after the runner has already given up on it. Two concrete
consequences:

- **The result is discarded**, not double-counted: the abandoned call's
  eventual resolution or rejection is not written to `observations.jsonl` --
  only the timeout failure is. This is enforced by ordinary Promise semantics
  (the race's winning branch is the only one that resolves the outer
  promise), not something acyclic-eval has to work to guarantee.
- **Effective concurrency can exceed the configured limit.** `runPool()`
  moves on to the next item as soon as `evaluate()`'s per-item work resolves
  -- which happens at the *timeout*, not when the judge's call actually
  finishes. A non-cooperative judge under sustained timeouts can accumulate
  far more truly-in-flight calls (open sockets, spawned processes, ...) than
  `concurrency` was set to allow.

`runner.ts` tracks this on a best-effort basis: every timeout that fires logs
a `console.warn`, and `getLeakedInFlightCount()` reports how many timed-out
calls haven't actually settled yet. This is observability, not mitigation --
it cannot cancel or rate-limit a non-cooperative judge, only tell you it's
happening. If your judge wraps a resource that can't be aborted (a
subprocess without a kill switch, a synchronous CPU-bound loop), treat
`timeoutMs` as "stop waiting," not "stop running."

## The limit: this is a structural guarantee, not a semantic one

None of the above can protect against:

- **Closure capture.** Nothing stops a `MutationOperator` implementation from
  closing over a reference to the judge instance in the surrounding module
  scope and calling it directly, bypassing the type system entirely. The
  guarantee is "the API surface does not hand you a judge" — not "it is
  impossible to reach one."
- **A judge-derived corpus.** If the corpus (`TSource[]`) passed to
  `selectMaterials` was itself produced by running the pipeline under test —
  e.g. a `RuleBasedClaimExtractor`-style component that is part of what's
  being evaluated — then selection is implicitly conditioned on that
  pipeline's own output, even though no `Judge` object was ever passed
  around. See "what counts as a judge" below.

**acyclic-eval guarantees non-injection at the API level. It does not, and
cannot, guarantee semantic independence of your corpus or your operators.**
That part of the job is the integrator's.

## What counts as "the judge" (read this before writing an operator)

The rule of thumb: **if a component's output would change when the judge's
own logic is fixed, don't use that component to decide what's "correct" or
which materials are structurally eligible.**

- Fine: a syntactic parser that locates a command line and the line after it
  (see `examples/toy/locator.ts`) — it never makes a pass/fail judgment.
- Fine: independently-authored structural anchors, or human annotation.
- **Not fine:** using an extractor that is part of the same pipeline as the
  judge under test to decide `target`, even if that extractor "just" finds
  claims rather than scoring them. [evigate](https://github.com/shiki-yusuke/evigate)'s
  `RuleBasedClaimExtractor` is exactly this trap: it is a legitimate *input* to claim-based detectors
  (you need it to find claims to mutate at all), but if the *same* claims it
  extracts are later used to grade whether the detector's *verdicts* were
  correct, the extractor has silently become part of the thing being judged.
  When adapting acyclic-eval to a new domain, ask explicitly: "if I introduced
  a bug in the judge today, could that bug also change what my operator
  thinks a valid material or target looks like?" If yes, that dependency
  needs to be replaced with something outside the judge's own code path.

## Recommended: enforce the import boundary with lint, not just discipline

If your judge and your operators live in the same package, add an
import-boundary rule so a `MutationOperator` module can never `import` the
judge module (or vice versa) even by accident:

```js
// .eslintrc.cjs (or eslint.config.js flat config equivalent)
module.exports = {
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["**/judges/**", "**/judge.js", "**/judge.ts"],
            message: "Mutation operators must not import a Judge implementation (see docs/threat-model.md).",
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ["**/operators/**", "**/*operator*.ts"],
      rules: {
        "no-restricted-imports": ["error", { patterns: [{ group: ["**/judges/**"] }] }],
      },
    },
  ],
};
```

This won't catch every case (a judge re-exported under an innocuous name will
slip past a glob), but it turns the common accident — an operator module
`import`-ing the judge for "convenience" — into a lint error instead of a
silent circularity.
