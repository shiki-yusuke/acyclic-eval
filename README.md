# acyclic-eval

Evaluate an LLM or rule-based judge with mutation cases whose generation never
consults the judge under test.

[![CI](https://github.com/shiki-yusuke/acyclic-eval/actions/workflows/ci.yml/badge.svg)](https://github.com/shiki-yusuke/acyclic-eval/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/acyclic-eval.svg)](https://www.npmjs.com/package/acyclic-eval)
[![license](https://img.shields.io/npm/l/acyclic-eval.svg)](./LICENSE)
[![Node.js >=18](https://img.shields.io/node/v/acyclic-eval.svg)](./package.json)

<!-- docs-sync: 2026-08-01 -->

`acyclic-eval` is a local-first TypeScript framework for teams that need to
test whether a judge handles structurally meaningful changes in a corpus. It
does not supply a universal judge or claim a general accuracy score. Instead,
you write domain-specific mutation operators and compare recorded judge output
against expectations that were established without calling that judge.

The bundled demo is credential-free and makes no network requests after
installation. The framework adds no telemetry and sends no artifacts anywhere;
any external traffic is owned by the Judge implementation you provide.

## What problem does this solve?

An ordinary evaluation can become circular when the same detector, extractor,
or upstream pipeline both influences which cases are admitted and is later
scored on those cases. A defect can then remove the very examples that would
have exposed it. acyclic-eval keeps generation, judgement, and comparison as
separate roles so an observed pass rate has a clear, inspectable scope.

## See it in action

```text
corpus + MutationOperator ──generate──> manifest + artifacts
                                             │
                                          Judge
                                             │
                                     observations.jsonl
                                             │
                                       Comparator ──score──> report
```

The Judge sees only an input case. The MutationOperator never receives the
Judge or its output; the Comparator can re-score recorded observations without
calling the Judge again.

## Quick start

Requires Node.js 18 or later. The current checkout is the immediately runnable
path while the next npm release is prepared:

```bash
git clone https://github.com/shiki-yusuke/acyclic-eval.git
cd acyclic-eval
npm ci
npm run demo
```

`npm run demo` creates and removes a temporary output directory. It runs the
self-contained rule-based transcript Judge with three mutation operators and
needs no credentials or network after `npm ci`.

### Packaged quick start (next npm release)

The following sequence is verified against the freshly packed tarball from
this checkout. At verification time, the public `latest` package was `0.1.3`
and its npm-bin symlink entrypoint did not execute; the fix is in this checkout
but has not been published. Do not present this as a current registry command
until a newer version has been released.

```bash
npm install acyclic-eval
npx acyclic-eval generate --config ./node_modules/acyclic-eval/dist/examples/toy/config.js --out ./acyclic-eval-out
npx acyclic-eval evaluate --config ./node_modules/acyclic-eval/dist/examples/toy/config.js --out ./acyclic-eval-out --samples 1
npx acyclic-eval score --config ./node_modules/acyclic-eval/dist/examples/toy/config.js --out ./acyclic-eval-out --min-coverage 1
```

## Expected output

```text
generated 9 case(s) into ./acyclic-eval-out
"okSamples": 9
- overall: 9/9 passed (100.0%), 0 infra errors, 9 total cases
- gate: PASS
```

The score timestamp is intentionally omitted above. See the complete,
regenerable [demo output](./docs/demo.md).

## Is this for me?

Use acyclic-eval when you own a corpus and can define structurally valid
mutations plus expected behavior independently of the judge being tested. It
works for deterministic rules, local models, and hosted-model adapters.

It is not a benchmark suite, a replacement for human gold labels, or a way to
prove a judge is semantically correct. Do not use it when your only expected
answer is produced by the same system under evaluation, or when an operator
cannot be made independent of that system.

## How it works

`generate` writes content-addressed case artifacts and a manifest.
`evaluate` records raw judge observations (with resume and integrity checks).
`score` compares those existing observations, so changing a comparator never
re-runs a potentially expensive or non-deterministic judge. Run generation and
evaluation as separate processes and keep judge credentials out of the
generation environment; the [threat model](./docs/threat-model.md) explains why.

## Examples

- [`examples/toy/`](./examples/toy/) — the runnable, self-contained toy domain.
- [`examples/rule-based-judge/`](./examples/rule-based-judge/) — a named entry
  point to the same no-network rule-based judge.
- [`examples/llm-judge-adapter/`](./examples/llm-judge-adapter/) — a
  vendor-neutral adapter template; it intentionally has no provider SDK,
  credentials, or runnable network call.
- [`examples/quickstart/`](./examples/quickstart/) — how the npm-package demo
  and local no-network demo relate.

For a local clone, `npm ci && npm run demo` runs the same pipeline in a new
temporary directory and cleans it up afterwards.

## Evaluation and evidence

The bundled toy run produces 9/9 on its own three-operator corpus. That is a
reproducibility demonstration only, not an accuracy claim. The documented
`0.1.0` evigate adapter validation compared 113 generated cases across eight
operators to its pre-adapter implementation case by case. It establishes
adapter-parity for that corpus and comparison, not the correctness of evigate,
other judges, or LLMs generally. One operator (M4) had 0/0 coverage in that
run and must not be interpreted as passing. See [evaluation](./docs/evaluation.md)
for the corpus counts, scope, and limits.

## Privacy and security

Artifacts and observations are written only to the output directory you choose.
Do not publish raw transcripts, prompts, command output, credentials, or local
paths in issues. Read [security](./docs/security.md) for reporting guidance and
the [threat model](./docs/threat-model.md) before trusting a score.

## Limitations

The framework provides API and process-boundary protections, not proof of
semantic independence. Closure capture, a judge-derived corpus, a malformed
operator, a non-cooperative timeout, and an unsuitable comparator can all
undermine an evaluation. See [limitations](./docs/limitations.md).

## Documentation

- [Concepts](./docs/concepts.md)
- [Architecture and CLI contract](./docs/architecture.md)
- [Evaluation methodology and evidence](./docs/evaluation.md)
- [Threat model](./docs/threat-model.md)
- [Limitations](./docs/limitations.md)
- [Security](./docs/security.md)
- [Development and package checks](./docs/development.md)
- [Release procedure](./docs/releasing.md)
- [Roadmap](./docs/roadmap.md)

## Related projects

- [**evigate**](https://github.com/shiki-yusuke/evigate) — verifies whether
  coding-agent completion claims have execution evidence; its mutation adapter
  is the documented real-world integration of acyclic-eval.
- [**agent-cost**](https://github.com/shiki-yusuke/agent-cost) — measures
  Claude Code and Codex CLI token usage and estimated cost.
- [**spec-lane**](https://github.com/shiki-yusuke/lane) — controls intent,
  specification, verification, and human decision gates in delivery work.
- [**ai-agent-skills-playbook**](https://github.com/shiki-yusuke/ai-agent-skills-playbook)
  — reusable workflows and guardrails for AI-assisted development.

Each project can be used independently. Together they form an evidence-first
AI coding toolkit: measure cost, verify claims, evaluate the verifier, control
delivery, and reuse the patterns.

## Contributing

Contributions and sanitized reproductions are welcome. See
[CONTRIBUTING.md](./CONTRIBUTING.md), [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md),
and [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE)

## 日本語ドキュメント

[README.ja.md](./README.ja.md) に日本語の導入、Quick start、制約をまとめています。
