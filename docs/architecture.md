# Architecture and CLI contract

The pipeline is intentionally persisted between stages:

```text
generate(corpus, operators)
  -> manifest.json + content-addressed artifacts
evaluate(manifest, judge)
  -> observations.jsonl
score(observations, comparator)
  -> report
```

## Generation

`generate()` calls `MutationOperator.selectMaterials`, `mutate`, and
`selfValidate`. It writes case inputs as content-addressed artifacts and a
manifest that carries each expected specification, target, operator identity,
and digest. A Judge is not an argument to this API.

## Evaluation

`evaluate()` reads each artifact, verifies its digest, and gives only the case
input plus `{ signal, sampleIndex }` to a Judge. It records raw output in
`observations.jsonl`, with judge id/version and input digest. Resume skips a
matching prior observation; changed artifacts or a changed judge identity are
invalidated and re-run. A torn final JSONL line can be repaired, but non-tail
corruption is an error rather than a silent skip.

`timeoutMs` is cooperative: the framework signals the Judge but cannot force
an ignored promise, process, or CPU loop to stop. See the timeout section of
the [threat model](./threat-model.md).

## Scoring

`score()` reads observations and current artifacts. It never calls a Judge.
It rejects mixed judge identities and artifact-digest mismatches, then applies
the Comparator. This permits changing a comparator and re-scoring exact,
already-recorded observations without another model call.

## CLI configuration boundary

The CLI has three commands:

```text
acyclic-eval generate --config <path> --out <directory>
acyclic-eval evaluate --config <path> --out <directory> [--samples N] [--concurrency N] [--timeout ms] [--retry N] [--no-resume]
acyclic-eval score --config <path> --out <directory> [--min-coverage 0..1] [--min-pass-rate 0..1] [--allow-zero-generated id,...]
```

The config module exports only the function a stage needs:

```ts
export async function generateConfig() { return { corpus, operators }; }
export async function evaluateConfig() { return { judge }; }
export async function scoreConfig() { return { comparator, metricAdapter }; }
```

Keep imports inside the respective function when they load a Judge. A static
top-level Judge import is evaluated even during `generate`, which defeats the
recommended process separation. The bundled
[`examples/toy/config.ts`](../examples/toy/config.ts) demonstrates the pattern.
