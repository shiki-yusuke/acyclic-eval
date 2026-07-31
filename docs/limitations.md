# Limitations

acyclic-eval enforces useful API and process boundaries. It cannot prove that
an evaluation is semantically independent or complete.

- **Closure capture can bypass the API.** An operator can still capture and
  call a Judge from module scope even though the framework does not pass one.
- **A judge-derived corpus is circular.** If the system being evaluated helped
  select source material, targets, or expected outcomes, structural separation
  in this package is not enough.
- **Operator validity is a design claim.** `selfValidate` can establish
  structural facts such as parseability; it cannot prove a mutation's semantic
  expectation is correct.
- **The comparator defines the score.** A weak, unsuitable, or changed
  Comparator changes what pass/fail means. Re-scoring is a feature, not proof
  that either comparator is correct.
- **Timeouts are cooperative.** A Judge that ignores `AbortSignal` can remain
  in flight after the recorded timeout and exceed intended real concurrency.
- **Coverage is not optional evidence.** An operator with no valid cases is
  untested. Use `minCoverage` and `allowZeroGenerated` deliberately rather
  than averaging missing structures away.
- **Mutation results are bounded by the corpus.** They do not measure unseen
  data distributions, adversarial behavior, or generalization.

See the detailed [threat model](./threat-model.md), especially its definition
of what counts as the Judge, before treating an evaluation as evidence.
