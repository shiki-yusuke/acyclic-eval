# acyclic-eval 0.1.4 Release Candidate

## Release intent

Prepare a backward-compatible patch release for the published `0.1.3` CLI
entrypoint defect, while carrying the already-reviewed documentation and
package-verification improvements. This is a local release candidate only.

## 0.1.3の不具合

`node dist/src/cli.js ...` worked because `process.argv[1]` resolved to the
same file as `import.meta.url`. npm creates `node_modules/.bin/acyclic-eval` as
a symlink. Through that path, the old string comparison saw the symlink path
instead of the CLI file path, so `main()` was not called and the process ended
without output.

## 根本原因

The entrypoint guard compared `path.resolve(process.argv[1])` directly with
`fileURLToPath(import.meta.url)`. It depended on path identity rather than
resolved filesystem identity and therefore did not model npm's generated bin
link.

## 修正内容

- Resolve both the invoked path and `import.meta.url` with `realpathSync`
  before deciding whether to call `main()`.
- Make `--help`/`-h` a successful, side-effect-free command.
- Keep the guard around `main()` so importing the library does not print help,
  call `process.exit`, or generate files.
- Version the package and lockfile to `0.1.4`.
- Add direct CLI, npm `npx`, `.bin` symlink, and library-import checks to the
  package verifier.

## 回帰テスト

The package verifier runs all of these against the packed candidate:

1. `node dist/src/cli.js --help`
2. `npx --no-install acyclic-eval --help`
3. `./node_modules/.bin/acyclic-eval --help`
4. `import("acyclic-eval")` and type checks for `generate`, `evaluate`, and
   `score`
5. The generate → evaluate → score toy pipeline

Each path must exit 0, print useful output, and avoid unexpected CLI output
during library import.

## Library API互換性

The public exports and declarations remain unchanged. `package.json` keeps the
same `exports`, `bin` target, Node runtime contract (`>=18`), module type, and
dependency shape; only the patch version and verification scripts changed.

## Package内容

The candidate must include `package.json`, README files, LICENSE, compiled
`dist/src` library and CLI, declarations, and the compiled toy configuration.
The verifier rejects source maps, tests, docs, coverage, `.env`, transcripts,
observations, manifests, and other transient files. The expected current list
is 48 files, subject to npm's generated metadata.

## Clean-room install結果

`npm run verify:package` packs into a temporary directory, installs into a
fresh consumer, checks all three CLI entrypoint paths plus library import, and
runs the toy pipeline. The final result must be `9/9` and `gate: PASS`.

## Supported Node.js検証

`engines.node` remains `>=18` as the library runtime contract. Local final
verification runs on the available Node.js 24 environment. CI covers Node.js
20, 22, and 24; Node.js 18 is not installed in this environment, and no
runtime installation is performed as part of this candidate.

## CI結果

The final local CI-equivalent run passed:

- `npm run typecheck`
- `npm test` — 9 files, 93 tests passed
- `npm run build`
- `npm run check:docs` — 35 Markdown files checked
- `npm run example`
- `npm run demo`
- `npm run verify:package`
- `npm pack --dry-run`
- `git diff --check`

The GitHub matrix and publish workflow have not been dispatched. Publish is
guarded to `main`, requires explicit confirmation, checks a clean tree, and
refuses a version already present on npm.

The first bare `npm pack --dry-run` attempt failed with `EPERM` because this
managed environment's user npm cache contains root-owned files. Re-running the
same command with a new temporary npm cache passed; no cache ownership or npm
credentials were changed.

## Docs整合性

`npm run check:docs` checks all local Markdown links and requires the English
and Japanese README Quick start blocks plus their sync marker to match. README
still clearly labels the registry `0.1.3` limitation; the next-release package
commands are not presented as currently available before publication.

## 未解決事項

- npm Trusted Publisher and GitHub Environment approval still require manual
  configuration.
- The registry must be checked again after publication; local tarball success
  does not prove the registry artifact is correct.
- Node.js 18 runtime behavior is covered by the declared contract but not by a
  local runtime execution in this environment.

## 公開前の手動チェック

- [ ] Review the complete uncommitted diff and confirm no secrets, local paths,
  tarballs, or generated output are included.
- [ ] Configure npm Trusted Publishing and optional GitHub Environment approval.
- [ ] Confirm the release is dispatched from `main` and the registry does not
  already contain `0.1.4`.
- [ ] Run the final local command list in this document.
- [ ] Create the GitHub Release only after human approval of the notes.

## 公開後の検証手順

Follow [POST-PUBLISH-VERIFICATION.md](./POST-PUBLISH-VERIFICATION.md) using
`npm install acyclic-eval@0.1.4` from a new temporary directory. Then follow
[POST-PUBLISH-UPDATE.md](./POST-PUBLISH-UPDATE.md) to remove pre-release caveats
from the README.

## Rollback方針

Do not reach for `npm unpublish` as a first response. Reproduce the issue from
the registry artifact, add a GitHub Release known-issue note, prepare a
corrected patch version, and use npm deprecation if users need an immediate
warning. Update README guidance only with a verified workaround.

## Release判定

**CONDITIONAL GO**. The local 0.1.4 candidate and clean-room checks pass. A
human must still configure npm Trusted Publishing, approve the protected
environment, confirm the `0.1.4` version is unpublished, and create the GitHub
Release. No publication is authorized by this document.
