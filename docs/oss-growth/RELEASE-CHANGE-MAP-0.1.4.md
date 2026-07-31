# Release change map — acyclic-eval 0.1.4

This map records the current release-candidate scope without changing or
discarding the preceding OSS Growth work.

| Category | Files / changes | Release relevance |
| --- | --- | --- |
| A. CLI不具合修正 | `src/cli.ts` | Resolves npm bin symlinks, keeps library imports quiet, and makes `--help` successful. |
| B. CLI・package回帰検証 | `scripts/verify-package.mjs`, package scripts | Tests direct CLI, `npx`, `.bin`, library import, package contents, and toy pipeline from a fresh tarball. |
| C. version / CHANGELOG | `package.json`, `package-lock.json`, `CHANGELOG.md` | Moves the patch candidate to `0.1.4` and records the user-facing fix. |
| D. CI / publish workflow | `.github/workflows/ci.yml`, `.github/workflows/publish.yml` | Keeps CI on Node 20/22/24 and adds a Node 18 runtime smoke test plus guarded publish checks. |
| E. README / documentation | `README.md`, `README.ja.md`, `docs/**` | Documents source and next-release package paths, limitations, release procedure, and post-publish updates. |
| F. examples / demo | `examples/**`, `scripts/demo.sh` | Provides deterministic, temporary-directory examples and a vendor-neutral LLM adapter. |
| G. Community Health Files | `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `.github/ISSUE_TEMPLATE/**`, PR template | Makes contribution and sensitive-reporting paths explicit. |
| H. OSS Growth / Launch Kit | `docs/oss-growth/**`, `docs/launch/**` | Records discovery, metrics, launch copy, manual actions, and release notes. |
| I. Release Candidate資料 | `RELEASE-CANDIDATE-0.1.4.md`, post-publish procedures, this map | Separates local evidence from human-gated publication and registry verification. |

## Deliberate non-actions

- No npm publish, tag push, GitHub Release, repository setting change, or
  Trusted Publisher registration is performed by local work.
- No provider SDK, telemetry, new evaluation claim, or public package
  deprecation is added.
