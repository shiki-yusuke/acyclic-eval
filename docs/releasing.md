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

Check the current registry version with `npm view acyclic-eval version` and
choose an unused version for the release. Update the package manifest and
lockfile together. After publishing, install the exact registry version in a
fresh temporary directory and run the packaged quickstart.

Review the tarball file list for generated artifacts, source maps, secrets,
transcripts, local databases, coverage, private corpora, and internal-only
documentation. Confirm that `repository.url` still points to
`https://github.com/shiki-yusuke/acyclic-eval.git`.

## npm Trusted Publishing setup (manual)

The release workflow lives at `.github/workflows/publish.yml`. To configure
or verify its npm Trusted Publisher, use these settings:

1. Open the `acyclic-eval` package settings on npm.
2. Add a Trusted Publisher for GitHub Actions.
3. Set GitHub user to `shiki-yusuke`, repository to `acyclic-eval`, and
   workflow filename to `publish.yml` exactly.
4. Optionally require the `npm-publish` GitHub Environment and assign
   reviewers before a publish can continue.
5. Consider a staged release for the first Trusted Publishing run.
6. After a successful provenance-verified release, revoke any superseded
   long-lived npm automation token.

The workflow selects the latest Node.js 24.x patch on a GitHub-hosted
runner and uses its bundled npm for Trusted Publishing (npm 11.5.1 or
later). The maintainer dispatches the workflow on main with the publish
input enabled. The job uses `id-token: write` and `npm publish --provenance`.

Create the GitHub Release and publish to npm only after the manual actions and
all checks are complete. Do not assume adding this file configured npm; it did
not.
