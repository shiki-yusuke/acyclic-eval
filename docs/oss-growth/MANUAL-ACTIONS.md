# Manual actions outside this checkout

Nothing in this list was performed by the local changes.

## GitHub repository and profile

- Set the [recommended description and topics](./GITHUB-SETTINGS.md).
- Set the recommended Website URL and social preview image manually.
- Decide and set the profile pin order; pinning is a profile-level action.
- Enable GitHub Discussions if the maintainer wants adapter-design questions
  separated from actionable issues.
- Do not enable GitHub Pages yet unless a maintainer commits to operating it.

## npm and release security

- Register the `acyclic-eval` npm package's Trusted Publisher for this
  repository and `.github/workflows/publish.yml`.
- Optionally create and protect the `npm-publish` GitHub Environment with
  required reviewers.
- Confirm the npm package's registry settings and the repository URL match
  `package.json` before dispatching the workflow.
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
