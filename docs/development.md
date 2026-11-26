# Development

## Requirements

Use the latest patch of Node.js 22, 24, or 26 LTS and its bundled npm. CI
runs the development checks on these three lines. The published CLI and
library also support Node.js 18, which CI exercises by installing the
tarball in a separate runtime smoke test.

## Setup and checks

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run check:docs
npm run verify:package
```

`npm run demo` runs the built toy pipeline in a temporary directory. It needs
no network after dependencies are installed. `npm run verify:package` builds,
packs to a temporary directory, rejects unwanted package content, creates a
fresh npm consumer, and executes the published-package quickstart against the
tarball.

The npm package includes the compiled core and the toy, rule-based judge,
and LLM adapter examples. A new example is available from a source checkout
until its compiled files are explicitly added to the package and verified.

Use `npm pack --dry-run` for a quick file-list inspection. Do not publish from
this command path; release preparation and npm Trusted Publishing setup are
documented in [releasing.md](./releasing.md).

## Documentation changes

Run `npm run check:docs`. It verifies local Markdown targets and requires the
English and Japanese READMEs to share the same quickstart command block and
`docs-sync` marker. Update both READMEs, their marker, and the PR checklist
when a first-use command changes.

## Sensitive reproductions

Never attach unredacted prompts, transcripts, local paths, `.env` files,
tokens, or `observations.jsonl` to an issue or pull request. Describe how to
create a minimal sanitized fixture instead.
