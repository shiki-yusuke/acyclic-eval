# Post-publish README update — acyclic-eval 0.1.4

This checklist is intentionally not performed before publication.

## Remove after registry verification

- Remove the README sentence explaining that public `0.1.3` predates the npm
  bin symlink fix.
- Remove the “Packaged quick start (next npm release)” caveat and make the
  `npm install acyclic-eval` / `npx acyclic-eval` sequence the main Quick start.
- Update the Japanese README's equivalent `0.1.3` and “次の npm release” caveats.
- Update `examples/quickstart/README.md` and `docs/launch/demo-script.md` so
  they no longer warn about the old public package.
- Keep the source checkout demo as a documented maintainer path.

## Verify before editing

From a clean temporary directory, install `acyclic-eval@0.1.4` from npm and
run the commands in [POST-PUBLISH-VERIFICATION.md](./POST-PUBLISH-VERIFICATION.md).
Confirm the registry reports `0.1.4`, the npm bin and direct CLI both print
help, library import is quiet, and the toy report is `9/9`.

## Badge and release wording

- Confirm the npm badge resolves to `0.1.4` or the intended current `latest`.
- Change “upcoming 0.1.4” language to “available in 0.1.4” only after the
  registry check succeeds.
- Do not change the evaluation scope, 9/9 toy qualification, or 113-case
  adapter-parity limitations.
