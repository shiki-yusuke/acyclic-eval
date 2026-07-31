# acyclic-eval 0.1.4

This patch fixes the `acyclic-eval` CLI when it is launched through npm's
generated bin symlink, including normal `npx acyclic-eval` usage.

## Fixed

- Fixed the npm CLI entrypoint producing no output when invoked through
  `node_modules/.bin/acyclic-eval`.
- Added fresh-install package verification for direct, `npx`, and npm bin
  execution paths.
- Preserved quiet library imports while enabling successful `--help` output.

## Documentation

- Reworked the quick start around a complete generate → evaluate → score flow.
- Added separate English and Japanese documentation.
- Added examples, threat-model guidance, release documentation, and
  contribution guidelines.

## Verification

The packed release candidate is installed into a clean temporary project and
completes the bundled toy evaluation with 9/9 passing cases. This is a
reproducibility smoke test, not a general LLM-judge accuracy claim.
