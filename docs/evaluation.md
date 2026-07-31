# Evaluation methodology and evidence

## What this framework measures

acyclic-eval measures whether a specific Judge's recorded outputs satisfy
independently specified expectations for a specific generated corpus. It does
not establish general semantic correctness, safety, production readiness, or
accuracy on an unseen population.

Report the corpus, operator versions, judge id/version, comparator, coverage,
and configured score gates with every result. A pass rate without those inputs
is not an interpretable claim.

## Bundled toy demonstration

The package's quickstart runs a rule-based transcript Judge over three
operators and generates nine valid cases. The expected output is 9/9. This is
a deterministic smoke test for installation and the three-stage pipeline; it
is not a benchmark and must not be presented as a Judge-accuracy result.

## Documented evigate adapter validation

The `0.1.0` release record documents a case-for-case shadow comparison while
moving evigate's mutation evaluation onto this framework. The documented
corpus had 113 cases across eight operators:

| Operator | Cases |
| --- | ---: |
| M1 | 3 |
| M2 | 4 |
| M3 | 19 |
| M4 | 0 |
| M5 | 19 |
| M6 | 3 |
| M7 | 51 |
| M8 | 14 |
| **Total** | **113** |

The recorded 113/113 match rate means the adapter's generated cases,
expectations, digests, and verdict comparison matched that pre-adapter
implementation for this corpus. It does **not** mean 100% detector accuracy,
100% LLM accuracy, or an evaluation of all possible inputs. M4 was 0/0 because
the corpus contained no occurrence of the targeted structure; it is zero
coverage, not evidence of a pass. The old implementation was removed only
after this comparison; see [CHANGELOG.md](../CHANGELOG.md) for the release
record.

## Data quality and human review

Treat `unknown` as a meaningful result when the evidence does not justify a
stronger classification. Do not force it into success or failure to improve a
headline metric. Keep human review for operator assumptions, corpus provenance,
unexpected mismatches, unrepresented structures, and a decision to use a score
as a release gate.

For the independence boundary, see [threat-model.md](./threat-model.md). For
known limits, see [limitations.md](./limitations.md).
