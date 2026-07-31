# acyclic-eval 0.1.4 Post-publish Verification

## Published version

- npm latest: `0.1.4`
- Published version: `0.1.4`
- Publish workflow: [run 30667825546](https://github.com/shiki-yusuke/acyclic-eval/actions/runs/30667825546)
- Commit: `2c2137306c9666279fb33e6da2cd94380082ceed`
- Environment: `npm-publish`
- Published at: `2026-07-31T21:48:34Z`

## npm metadata

- Repository: `shiki-yusuke/acyclic-eval`
- Integrity: `sha512-zlyZC3B/yx0BMXYRu4oJKT0YvR6hsBkqi3M8CIgXJkYEIUId6WMO9SKBSFg9noGhIiYqg1q5dq7DgrqZobjhQQ==`
- Shasum: `6bd8777d1ecca1602dffa71ffceded32d12832a6`
- File count: 48
- Provenance attestation: present

## Registry install environment

- Install source: npm registry
- Install command: `npm install acyclic-eval@0.1.4`
- Temporary clean-room project: used; local path omitted

## CLI help

- Direct CLI: PASS
- `npx --no-install acyclic-eval --help`: PASS
- `./node_modules/.bin/acyclic-eval --help`: PASS

## Library import

PASS — `generate`, `evaluate`, and `score` imported as functions without CLI side effects.

## Generate result

PASS — generated 9 cases.

## Evaluate result

PASS — evaluated 9 samples with 9 successful samples and 0 infrastructure errors.

## Score result

PASS — overall `9/9`, gate `PASS`.

## Toy smoke test

9/9 PASS

This is a bundled toy smoke test and not a general accuracy claim.

## GitHub Release

- Tag: `v0.1.4`
- Release: https://github.com/shiki-yusuke/acyclic-eval/releases/tag/v0.1.4

## Known limitations

The bundled toy result does not establish general LLM-judge accuracy or production readiness.

## 0.1.3 deprecation recommendation

Recommend considering a deprecation notice for `0.1.3` explaining that its npm-generated bin symlink entrypoint is broken and users should upgrade to `0.1.4` or later. No deprecation command was executed.

## Final release status

RELEASED
