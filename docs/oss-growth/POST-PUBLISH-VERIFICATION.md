# Post-publish verification — acyclic-eval 0.1.4

Run this only after a human has published the package. It must use npm
registry state, not the local tarball.

```bash
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
cd "$TMP_DIR"

npm init -y
npm install acyclic-eval@0.1.4

npx acyclic-eval --help

npx acyclic-eval generate \
  --config node_modules/acyclic-eval/dist/examples/toy/config.js \
  --out ./out

npx acyclic-eval evaluate \
  --config node_modules/acyclic-eval/dist/examples/toy/config.js \
  --out ./out \
  --samples 1

npx acyclic-eval score \
  --config node_modules/acyclic-eval/dist/examples/toy/config.js \
  --out ./out \
  --min-coverage 1
```

Expected result: help is printed with exit code 0, the three stages exit 0,
and the report says `overall: 9/9 passed` and `gate: PASS`.

Also inspect registry metadata:

```bash
npm view acyclic-eval version
npm view acyclic-eval@0.1.4 dist
npm view acyclic-eval@0.1.4 repository
npm view acyclic-eval@0.1.4 engines
npm view acyclic-eval@0.1.4 bin
```

Confirm the version, repository URL, Node engine, and `dist` contents match the
release candidate. Then complete [POST-PUBLISH-UPDATE.md](./POST-PUBLISH-UPDATE.md).

## If verification fails

1. Capture the exact registry version, command, exit code, and sanitized output.
2. Reproduce from a second clean temporary directory.
3. Add a known issue to the GitHub Release and stop promotion of dependent docs.
4. Prepare a corrected patch version and use `npm deprecate` only when a clear
   user-facing warning is necessary.
5. Do not use `npm unpublish` casually; follow npm policy and preserve a clear
   provenance trail.
