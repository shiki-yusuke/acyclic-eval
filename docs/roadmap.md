# Roadmap

## Completed foundation

- Framework core: domain-defined mutation generation, content-addressed
  artifacts, evaluation observations, comparator-based scoring, and a
  self-contained toy example.
- Documented evigate adapter validation: the release record describes a
  case-for-case comparison over 113 cases across eight operators. Its scope
  and zero-coverage limitation are documented in [evaluation.md](./evaluation.md).
- Integrity hardening: asynchronous structural validation, judge-identity
  resume checks, per-operator coverage gates, and manifest-reader defenses.

## Next directions

- Add carefully documented example domains only when their corpus provenance
  and expected values can be made independent of the Judge under evaluation.
- Improve adapter guidance without adding provider SDKs or credentials to the
  core package.
- Collect feedback on the threat model, operator design, and how teams preserve
  a human gate for ambiguous or `unknown` outcomes.

This is a direction list, not a release promise. It does not imply a generic
accuracy benchmark, provider integration, telemetry, or a new CLI command.
