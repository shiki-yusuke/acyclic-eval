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
only has judge credentials and a read-only manifest). The manifest's
`artifactDigest`/`sourceDigest` fields let `evaluate`/`score` detect if a
generated case was modified after the fact, so even a compromised or buggy
second process can't silently rewrite what was actually generated.

## Layer 3: re-scoring without re-running the judge

`score()` never calls a judge — it only reads `observations.jsonl` (the raw,
already-recorded judge outputs) and a `Comparator`. This means a comparator
bug can be fixed and the report regenerated for free, without touching the
(possibly expensive, possibly non-deterministic) judge calls at all — nothing
about re-scoring can smuggle judge behavior back into generation.

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
  claims rather than scoring them. evigate's `RuleBasedClaimExtractor` is
  exactly this trap: it is a legitimate *input* to claim-based detectors
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
