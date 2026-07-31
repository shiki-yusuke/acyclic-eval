# Quickstart assets

The package candidate ships a compiled, self-contained toy configuration at
`dist/examples/toy/config.js`. The README's three commands deliberately use
that compiled asset so a maintainer can test a freshly packed tarball without
cloning a second copy of this repository.

For a local checkout, use the no-network demonstration after dependencies are
installed and the package is built:

```bash
npm ci
npm run build
./scripts/demo.sh
```

The script creates and removes its own temporary directory. It does not change
your corpus, credentials, or existing evaluation output.

The published `0.1.4` package includes the npm-bin symlink fix. After a release,
re-run the registry verification commands from
`docs/oss-growth/POST-PUBLISH-VERIFICATION.md` when validating a new version.
