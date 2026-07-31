# Concepts

acyclic-eval evaluates a **Judge** through cases whose generation does not
consult that Judge. It is designed for a situation where a score is useful
only if the system under test could not decide which failures it is allowed to
be tested on.

## The three roles

| Role | Responsibility | Must not depend on |
| --- | --- | --- |
| `MutationOperator` | Select structural material, mutate it, and self-validate the mutation. | The Judge, its output, or evaluation results. |
| `Judge` | Evaluate one case input. | Expected value, mutation target, operator id, tags, and other provenance metadata. |
| `Comparator` | Turn an expected specification and recorded actual output into pass/fail. | Re-running the Judge or changing the corpus. |

The distinction is practical rather than cosmetic. A recall-side operator
removes evidence on which a correct answer should depend, usually expressed as
`forbid` or a narrow `oneOf`. A precision-side operator adds irrelevant noise
that a correct answer should ignore, usually expressed as `equals`. A useful
evaluation needs both: recall-only tests can reward an always-`unknown` Judge,
and precision-only tests can reward a Judge that always returns a safe default.

## Expected specifications

An operator emits an `ExpectedSpec`:

- `equals` — exactly one answer is acceptable.
- `oneOf` — several explicitly listed answers are acceptable.
- `forbid` — listed answers must not occur.

The expectation is an assertion made by the operator design, not a label
inferred from the Judge's response. If the expectation cannot be established
independently, use human annotation, an independently authored structural
rule, or do not treat the result as non-circular.

## Coverage and a pass bar

`score()` reports counts and pass rates. A `MetricAdapter` can add a
domain-defined confusion matrix; the core deliberately does not guess what a
positive class means. `minCoverage`, `minPassRate`, and
`allowZeroGenerated` make pass criteria explicit. In particular, zero coverage
for one operator must not disappear inside a high aggregate rate.

For type-level contracts and the process boundary, read
[architecture.md](./architecture.md). For guarantees and non-guarantees, read
[threat-model.md](./threat-model.md) and [limitations.md](./limitations.md).
