# Contributing to acyclic-eval

Thanks for helping make judge evaluations more inspectable. This project is a
Node.js package; the published runtime contract is Node.js 18 or later. CI
exercises Node.js 20, 22, and 24.

## Setup

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run check:docs
npm run demo
npm run verify:package
```

There is currently no separate lint script. `npm run typecheck` is the static
check; do not claim a lint command exists unless one is added to
`package.json` and CI. `npm run demo` regenerates the terminal demonstration
in a temporary directory. `npm run verify:package` runs `npm pack` in a
temporary directory, checks the package file list, installs the tarball into a
fresh consumer, and executes the bundled toy quickstart.

Before opening a PR, also inspect `npm pack --dry-run` and make sure the
README's first Quick start command block remains identical in `README.md` and
`README.ja.md`.

## Design constraints

- A `MutationOperator` must not import, call, or derive eligibility from the
  Judge it evaluates.
- Keep generation and evaluation separable. Judge imports belong inside
  `evaluateConfig()`, not at config-module top level.
- Preserve `unknown` where evidence does not support a stronger label.
- Add tests for correctness, malformed artifacts, resume behavior, and any
  integrity boundary affected by a change.
- Do not add a provider SDK or credentials to the framework core merely to
  demonstrate an LLM Judge. Use an adapter owned by the consuming project.

Read [docs/threat-model.md](./docs/threat-model.md) before changing these
boundaries.

## Bug reports and reproductions

Include the Node.js and npm versions, package version or commit, the exact
sanitized command, expected behavior, actual behavior, and a minimal fixture
that can be shared publicly. Do **not** attach raw transcripts, prompts,
`observations.jsonl`, API keys, `.env` files, local paths, or production logs.
Describe the shape of sensitive material or provide a redacted synthetic
fixture instead.

## Pull requests

Keep a PR focused, update user-facing documentation and tests with behavior
changes, and use the provided template. Report checks actually run, including
any platform or provider behavior that could not be reproduced locally.
