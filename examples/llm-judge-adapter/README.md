# LLM judge adapter template

[`adapter.ts`](./adapter.ts) is a dependency-free template for adapting an LLM
or local model to the `Judge` interface. It is intentionally not a runnable
provider integration: model credentials, request logging, rate limits,
redaction, and provider choice belong to the consuming application.

Implement `LlmInvoker.invoke()` outside mutation-operator modules. Pass
`context.signal` through to a cancellable client when possible, and give the
judge a stable, non-secret `id` and `version` so resumed observations do not
blend results from different judge versions.

This template does not make the evaluation semantically independent by itself.
Read the [threat model](../../docs/threat-model.md) before supplying a corpus,
operator, or prompt construction path.
