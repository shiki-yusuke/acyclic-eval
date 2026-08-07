# Manual actions outside this checkout

Nothing in this list was performed by the local changes. Status below was
verified live against GitHub/npm settings on 2026-08-08.

## GitHub repository and profile

- [x] Description and topics match [GITHUB-SETTINGS.md](./GITHUB-SETTINGS.md)
  and `package.json` keywords.
- [x] Website URL set to `https://github.com/shiki-yusuke/acyclic-eval#readme`.
- [x] Social preview image set (three-role generation/Judge/comparator
  diagram).
- [x] GitHub Discussions enabled.
- [ ] Profile pin order: kept as the maintainer's existing order, not the
  `agent-cost -> evigate -> ...` sequence suggested in GITHUB-SETTINGS.md.
  Reason: `agent-cost` needs something else to have already run before there
  is anything to measure, so putting it first does not match actual usage
  order. GITHUB-SETTINGS.md's suggested sequence should be revisited before
  it is cited again.
- Do not enable GitHub Pages yet unless a maintainer commits to operating it
  (no change; this remains the default).

## npm and release security

- [x] Trusted Publisher already registered on npmjs.com (`shiki-yusuke/acyclic-eval`,
  workflow `publish.yml`, environment `npm-publish`) — predates this checklist
  update; likely set up during the 0.1.4 release.
- [x] `npm-publish` GitHub Environment has a required-reviewers protection
  rule (reviewer: `shiki-yusuke`, `prevent_self_review: false`).
- Confirm the npm package's registry settings and the repository URL match
  `package.json` before dispatching the workflow (recurring pre-release
  check, not a one-time action).
- Create a GitHub Release and publish to npm only after the checklist in
  [docs/releasing.md](../releasing.md) passes. No release, tag, or publish was
  created here.
- PyPI Trusted Publishing is **not applicable** to this Node.js/npm package.

## Launch and measurement

- Use the staged launch order in [content-roadmap.md](../launch/content-roadmap.md);
  do not announce the portfolio as one bundled launch.
- Post selected, constraint-aware copy to X, Slack, Zenn/Qiita, LinkedIn,
  Reddit, or Hacker News only after a human reviews it for current links and
  claims.
- Review GitHub Traffic and npm data manually. Do not add user telemetry just
  to complete the metrics table.
