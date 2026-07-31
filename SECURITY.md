# Security policy

## Reporting a vulnerability

Do not open a public issue with a vulnerability report or with sensitive
evaluation material. Use this repository's **GitHub Security Advisories**
“Report a vulnerability” flow instead. Include a minimal, redacted
reproduction, affected package version, impact, and suggested mitigation if
known.

Do not include API keys, access tokens, raw prompts, transcripts, command
output, local paths, `.env` files, manifests, or `observations.jsonl` unless
they are essential and have been sanitized. No separate security email address
is declared by this repository.

## Scope notes

The framework is local-first and has no telemetry endpoint. A consuming Judge
may call external services or handle credentials; secure configuration of that
Judge is the consuming application's responsibility. See
[docs/security.md](./docs/security.md) and
[docs/threat-model.md](./docs/threat-model.md) for design constraints.
