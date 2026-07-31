# Releasing acyclic-eval

This document describes a release path; it does not publish a package.

## Local release candidate checks

From the repository root, run:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run check:docs
npm run verify:package
npm pack --dry-run
```

The public `0.1.3` package already exists and predates this checkout's npm-bin
symlink fix. Bump to a new, intentional version before publishing. After the
release, install that exact registry version in a new temporary directory and
run the packaged quickstart again; a locally packed tarball is necessary but
not sufficient evidence of a successful registry release.

Review the tarball file list for generated artifacts, source maps, secrets,
transcripts, local databases, coverage, private corpora, and internal-only
documentation. Confirm that `repository.url` still points to
`https://github.com/shiki-yusuke/acyclic-eval.git`.

## npm Trusted Publishing setup (manual)

The repository includes a **manual and guarded** workflow proposal at
`.github/workflows/publish.yml`. Before a maintainer can use it, configure npm
manually:

1. Open the `acyclic-eval` package settings on npm.
2. Add a Trusted Publisher for GitHub Actions.
3. Set GitHub user to `shiki-yusuke`, repository to `acyclic-eval`, and
   workflow filename to `publish.yml` exactly.
4. Optionally require the `npm-publish` GitHub Environment and assign
   reviewers before a publish can continue.
5. Consider a staged release for the first Trusted Publishing run.
6. After a successful provenance-verified release, revoke any superseded
   long-lived npm automation token.

The workflow uses a GitHub-hosted runner, Node.js 22.14 or later, npm 11.5.1
or later, `id-token: write`, and `npm publish --provenance`. It remains inert
unless a maintainer manually dispatches it with an explicit confirmation.

Create the GitHub Release and publish to npm only after the manual actions and
all checks are complete. Do not assume adding this file configured npm; it did
not.
