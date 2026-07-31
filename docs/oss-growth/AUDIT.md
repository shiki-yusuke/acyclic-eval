# OSS Growth Audit — acyclic-eval

Audit date: 2026-08-01
Scope: the local `shiki-yusuke/acyclic-eval` checkout only. No repository settings or registry state was changed.

## Inventory

| Area | Found at audit time | Assessment |
| --- | --- | --- |
| README | `README.md` only; English and Japanese content are duplicated in one long file | The technical content is valuable, but the first-use path is buried. |
| Package | `package.json`, `package-lock.json`; package name and CLI are both `acyclic-eval` | Names are coherent. The package exposes `dist` and a CLI, but its package contents and a clean install path had not been verified in this checkout. |
| Documentation | `docs/threat-model.md` | The threat model is unusually strong and must be retained; concepts, architecture, evaluation, limitations, security, and development entry points are absent. |
| Examples | `examples/toy/` | The self-contained rule-based example exists, but there is no documented quickstart directory, deterministic demo script, or vendor-neutral LLM-adapter template. |
| Community health | `LICENSE`, `CHANGELOG.md` | `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, issue forms, and a PR template are absent. |
| CI and releases | `.github/workflows/ci.yml` runs `npm ci`, typecheck, tests, and the toy example on Node 20 for `main` pushes and pull requests | A baseline CI exists, but it did not check documentation links, packed file contents, a fresh tarball install, or release provenance. No Trusted Publishing guidance was found. |
| Changelog | `CHANGELOG.md` ends at `0.1.2`, while `package.json` is `0.1.3` | Release history is incomplete for the current package version. |
| Registry check | The first `npm view` attempt could not write the user-level npm cache | Registry state must be rechecked with an isolated cache; the cache ownership issue must not be “fixed” by changing user permissions. |

## Findings and recommendations

### P0 — shorten and make the first success reproducible

- **重要度:** P0
- **対象利用者:** AI-evaluation practitioners evaluating an LLM or rule-based judge for the first time.
- **現在の問題:** The README explains the complete motivation, API boundaries, timeout behavior, and integration history before giving a compact, copyable success path. `npm install acyclic-eval` is shown, but the runnable configuration hidden inside the installed package is not shown as a package-based quickstart.
- **推奨変更:** Put a one-sentence value proposition, role diagram, package-based three-command toy run, expected output, fit/non-fit guidance, privacy statement, and links to detailed documents at the front of the README. Keep all existing threat-model and evaluation qualifications in dedicated documentation.
- **変更によるリスク:** Moving material can hide critical limitations or introduce a command that does not work from an installed tarball.
- **検証方法:** Build the package, install its tarball in a newly created temporary directory, execute the documented generate/evaluate/score commands, and compare the reported 9/9 result to the README.

### P0 — establish package and CLI evidence

- **重要度:** P0
- **対象利用者:** npm users and maintainers preparing a release.
- **現在の問題:** `name`, `bin`, repository links, and the `files` allow-list exist, but there is no checked-in command that inspects the packed tarball or proves that its bundled toy configuration works after a fresh install. The initial registry query was blocked by a local cache-permission problem.
- **推奨変更:** Add an isolated fresh-package verification script, document `npm pack --dry-run`, add `publishConfig.access`, and run package checks in CI and pre-publish checks. Query npm with a temporary cache only; never change a user npm-cache owner as part of this task.
- **変更によるリスク:** A verification script can accidentally depend on the source checkout or network.
- **検証方法:** Run it with a temporary npm cache and assert that the installed package's own CLI and bundled `dist/examples/toy/config.js` produce the expected output without network access.

### P0 — add safe contribution and disclosure paths

- **重要度:** P0
- **対象利用者:** Potential contributors, bug reporters, and security researchers.
- **現在の問題:** The repository has a baseline CI workflow but no contribution instructions, security reporting guidance, code of conduct, issue forms, or PR template. Transcript-like evaluation artifacts can contain sensitive local material, so a generic “open an issue” path is unsafe.
- **推奨変更:** Add concise community-health files and GitHub forms that request sanitized reproductions. Direct sensitive reports to GitHub Security Advisories without inventing an email address.
- **変更によるリスク:** Boilerplate can promise support channels or privacy guarantees that do not exist.
- **検証方法:** Review all forms and templates for a clear redaction warning and validate YAML syntax through GitHub Actions on the repository.

### P0 — give maintainers discoverability settings and launch material

- **重要度:** P0
- **対象利用者:** Maintainers configuring GitHub and people encountering the project through search or a launch post.
- **現在の問題:** There is no repository-local source for a GitHub description, topics, social-preview copy, metrics definitions, launch copy, or manual actions. The current README has no role-based related-project link.
- **推奨変更:** Add `docs/oss-growth/` and `docs/launch/` materials that distinguish local changes from GitHub/npm settings and link acyclic-eval to its direct portfolio neighbors.
- **変更によるリスク:** Marketing copy could overstate the 9/9 toy run or the 113/113 evigate integration validation.
- **検証方法:** State corpus, count, and limits wherever either result is mentioned; review all copy against the source implementation and existing threat model.

### P1 — organize, do not discard, the technical trust material

- **重要度:** P1
- **対象利用者:** Integrators designing custom mutation operators, judges, and comparators.
- **現在の問題:** Concepts, architecture, evaluation methodology, limits, and security considerations are mixed into the README. Only `docs/threat-model.md` is available as a deep link.
- **推奨変更:** Add focused documents and leave the threat model intact; make the README route readers to them after the quickstart.
- **変更によるリスク:** Duplicate statements can drift between the README and docs.
- **検証方法:** Add a documentation-link and quickstart-command consistency check, and retain direct links to the threat model and limitations from the README.

### P1 — make demonstrations safe and portable

- **重要度:** P1
- **対象利用者:** Developers trying a local clone on macOS or Linux.
- **現在の問題:** The existing `npm run example` writes to a fixed checkout-local `.acyclic-eval-example-out` directory and removes it before generating output. No script demonstrates cleanup, no-network operation, or a deterministic presentation of generated output.
- **推奨変更:** Use a system temporary directory for the bundled runner and add `scripts/demo.sh` plus `docs/demo.md`. Add a clearly non-runnable, vendor-neutral LLM-judge adapter template so the core stays dependency-free.
- **変更によるリスク:** Shell portability or output normalization can obscure a failed command.
- **検証方法:** Run the demo from a clean build on this macOS environment; inspect that it cleans up its own temporary directory and that its displayed report matches the README.

### P1 — make release provenance deliberate

- **重要度:** P1
- **対象利用者:** Release maintainers and downstream users assessing supply-chain provenance.
- **現在の問題:** The existing CI proves the source toy example on Node 20, but no release guide or repository workflow describes npm Trusted Publishing. `CHANGELOG.md` lacks a `0.1.3` entry despite the manifest version.
- **推奨変更:** Add a manual-triggered, guarded workflow design using npm Trusted Publishing and document the npm-side configuration that cannot be made from a checkout. Add a factual `0.1.3` changelog entry limited to known release metadata.
- **変更によるリスク:** A workflow may be mistaken for completed npm-side configuration, or accidentally create an automatic publish path.
- **検証方法:** Keep the workflow manual/guarded, do not invoke it, and document that npm Trusted Publisher registration and any GitHub Environment approval are manual actions.

### P2 — broader examples and ecosystem positioning

- **重要度:** P2
- **対象利用者:** Teams adapting the framework to an external LLM provider or comparing related AI-development tools.
- **現在の問題:** Only a toy, rule-based domain is executable in this repository. The current evigate integration evidence is valuable but is not a general accuracy benchmark.
- **推奨変更:** Add documentation-only/vendor-neutral adapter guidance and a related-project map. Defer any provider SDK, a benchmark corpus, telemetry, or new CLI subcommands until a concrete compatibility and security design exists.
- **変更によるリスク:** A provider-specific example could pull credentials or a vendor dependency into the core package; a benchmark claim could imply general accuracy.
- **検証方法:** Keep the adapter template free of SDK imports and credentials, and label the toy and 113-case integration evidence with their scope and limitations.
