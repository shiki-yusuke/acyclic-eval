# OSS Growth implementation report — acyclic-eval

Date: 2026-08-01
Scope: local repository changes only. No push, tag, GitHub Release, registry
publish, npm setting, or GitHub repository setting was performed.

## Problems resolved

- Replaced a long, mixed-language README opening with a runnable source
  Quick start and a clearly marked, verified next-release package path.
- Preserved threat-model, data-quality, `unknown`, coverage, provenance,
  timeout, and human-review guidance in focused documentation.
- Fixed the installed npm binary path. npm creates a `.bin` symlink, while the
  previous CLI only recognized its non-symlink source path and silently did
  nothing when invoked through the package bin.
- Made `npm run example` and `scripts/demo.sh` own temporary output rather
  than deleting checkout-local output.
- Added checks for documentation links, bilingual Quick start consistency,
  package file content, fresh tarball installation, and the README commands.
- Added contribution, security, conduct, issue, PR, CI, release, discovery,
  metric, and launch paths with sensitive-data warnings.

## Changed files

| Area | Files |
| --- | --- |
| First-use docs | `README.md`, `README.ja.md`, `docs/demo.md`, `docs/assets/README.md`, `docs/concepts.md`, `docs/architecture.md`, `docs/evaluation.md`, `docs/limitations.md`, `docs/security.md`, `docs/development.md`, `docs/releasing.md` |
| Examples and demo | `examples/toy/run.ts`, `examples/quickstart/README.md`, `examples/rule-based-judge/config.ts`, `examples/rule-based-judge/README.md`, `examples/llm-judge-adapter/adapter.ts`, `examples/llm-judge-adapter/README.md`, `scripts/demo.sh` |
| Package and executable | `package.json`, `src/cli.ts`, `scripts/verify-package.mjs` |
| Documentation verification | `scripts/check-doc-links.mjs`, `scripts/check-readme-sync.mjs` |
| Community and CI | `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `.github/ISSUE_TEMPLATE/*`, `.github/pull_request_template.md`, `.github/workflows/ci.yml`, `.github/workflows/publish.yml` |
| Release and growth records | `CHANGELOG.md`, `docs/oss-growth/AUDIT.md`, `docs/oss-growth/GITHUB-SETTINGS.md`, `docs/oss-growth/METRICS.md`, `docs/oss-growth/MANUAL-ACTIONS.md`, `docs/launch/*` |

`NAMING-DECISION.md` is not applicable: repository name, npm package name,
and CLI command are all `acyclic-eval`.

## Validation performed

| Check | Result |
| --- | --- |
| `npm --cache <temporary-dir> ci` | Passed; 53 packages installed, 0 vulnerabilities reported. |
| `npm run typecheck` | Passed. |
| `npm test` | Passed: 9 test files, 93 tests. |
| `npm run build` | Passed. |
| `npm run check:docs` | Passed: 31 Markdown files checked; README quickstart and sync marker aligned. |
| `npm run demo` | Passed: isolated temporary output; 9/9 toy report and PASS gate. |
| `npm --cache <temporary-dir> pack --dry-run` | Passed: 48 files; no source maps, test/docs directories, or transient evaluation artifacts in the packed file list. |
| `npm run verify:package` | Passed: `npm pack` to a temporary directory, 48-file inspection, fresh consumer installation, and the README-style `npx --no-install acyclic-eval` generate/evaluate/score pipeline yielded 9/9. |
| npm registry query with an isolated temporary cache | Passed: `acyclic-eval` `latest` was `0.1.3` at verification time. |

Validation ran locally on macOS with Node.js `v24.12.0` and npm `11.6.2`.
The updated CI matrix will exercise Node 20, 22, and 24 on Linux after a human
pushes the changes; remote CI was intentionally not invoked.

## Failures encountered and resolved

| Command or check | Initial result | Resolution |
| --- | --- | --- |
| `npm view` / bare `npm pack --dry-run` | Could not write the user-level npm cache because it contains root-owned files. | Used a new temporary npm cache. No ownership or credential setting was changed. |
| First package verifier | Expected `npm pack --json` file names with a `package/` prefix. | Corrected the verifier to use npm's actual package-root-relative paths. |
| Fresh package CLI run | npm's `.bin/acyclic-eval` symlink produced no output. | Resolved symlinks in the CLI entrypoint test; the fresh package now executes all documented commands. |
| Current public `acyclic-eval@0.1.3` package | Its symlinked CLI exited without output in an isolated installation. | The README labels the npm sequence as next-release only; publish a new intentional version after completing the release checklist. |

## README comparison

| Measure | Before | After |
| --- | ---: | ---: |
| Fresh-user path to complete toy result | 5 commands from a clone (`git clone`, `cd`, install, build, example) | 4 commands from a clone (`git clone`, `cd`, `npm ci`, `npm run demo`) |
| First complete example command | Line 60: `npm run example` after clone/build | Line 56: `npm run demo` |
| README lines before first complete example command | 60 | 56 |
| Language layout | Full English and Japanese summary in one README | Short Japanese README with an automated first-Quick-start consistency check |

The prior standalone `npm install acyclic-eval` line did not provide a
package-based configuration or output path. The next-release package sequence
uses the compiled toy configuration included in the tarball and was verified
from that tarball. It is not advertised as a current public-registry command,
because the public `0.1.3` package predates the entrypoint fix.

## Remaining risks and manual work

- The vendor-neutral LLM adapter is intentionally a template. It has not been
  tested against any provider, local model, credentials flow, or private corpus.
- The 9/9 toy report is a smoke test, and the historical 113-case evigate
  comparison is scoped adapter-parity evidence. Neither is a general accuracy
  claim.
- A version bump and publish are required before the packaged Quick start can
  replace the source Quick start. They remain intentional manual actions.
- CI syntax and the 20/22/24 Linux matrix have not run remotely because this
  change was not pushed.
- npm Trusted Publishing requires npm-side registration and optional GitHub
  Environment protection; adding the workflow did not configure either.
- GitHub description, topics, Discussions, profile pins, social preview,
  release creation, and launch posts remain manual actions listed in
  [MANUAL-ACTIONS.md](./MANUAL-ACTIONS.md).

## Pre-publish checklist

- [ ] Review the current diff and rerun all validation commands above.
- [ ] Confirm the npm package version and `repository.url` are intentional.
- [ ] Inspect `npm pack --dry-run` on the release candidate.
- [ ] Verify README commands against the packed tarball.
- [ ] Register and test npm Trusted Publishing through the guarded workflow.
- [ ] Create a GitHub Release only after a human approves the notes and limits.
- [ ] Publish to npm only after the release checklist; no publish occurred here.
