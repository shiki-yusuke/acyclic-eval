# Security and privacy design

acyclic-eval is local-first: it writes generated artifacts, manifests, and
observations to the output directory selected by the caller. It has no
telemetry endpoint and does not require credentials. A Judge implementation
may make network calls or handle secrets; that behavior is outside the core
framework and must be reviewed by the integrator.

## Protect evaluation material

- Keep API keys, access tokens, and provider configuration out of config
  modules committed to source control.
- Treat transcripts, prompts, command output, artifact files, and
  `observations.jsonl` as potentially sensitive. Redact them before sharing.
- Run `generate` separately from `evaluate` when feasible, with no Judge
  credentials in the generation environment.
- Use an output directory with appropriate local access controls.
- Do not use `unknown` output as a pretext to expose more source material than
  is necessary for review.

For a vulnerability or sensitive disclosure, follow [SECURITY.md](../SECURITY.md).
For integrity and circularity boundaries, read [threat-model.md](./threat-model.md).
