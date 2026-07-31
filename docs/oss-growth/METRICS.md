# Privacy-preserving growth metrics

acyclic-eval adds no default telemetry. Interpret external signals as proxies,
not as direct knowledge of a person's successful use.

## Metric model

| Metric | Definition | Privacy-preserving proxy | Caveat |
| --- | --- | --- | --- |
| North Star Metric | Estimated users reaching their first useful output after a fresh install. | npm downloads combined with public issue/discussion evidence and GitHub traffic trends. | A download is not an activation; do not present it as one. |
| Activation Metric | Fresh install reaches the documented 9/9 toy report or a user's first custom score. | Periodic maintainer-run fresh-package verification; documentation issues about Quick start. | The bundled toy does not reveal private user activations. |
| Retention proxy | Continued public signals after first contact. | Repeat releases adopted by dependents, returning contributors, follow-up discussions, repeat external references. | Most continued use is private and unobservable. |
| Community Metric | Constructive public participation. | Issues, discussions, PRs, and external contributors, weighted qualitatively rather than by raw volume. | More issues can mean friction, not health. |
| Supply-chain trust metric | Evidence that a package can be reproduced and provenance reviewed. | Passing CI/package checks, documented Trusted Publishing setup, release provenance after a human publishes. | A workflow file alone is not Trusted Publishing enrollment. |

## Observable sources

- **GitHub:** stars, forks, watchers, unique visitors, clones, issue count,
  external contributors, discussions, and public references.
- **npm:** weekly/monthly downloads and public dependents where available.
- **Documentation:** distance from README to Quick start, command count,
  periodic fresh-install success, and documentation issues.
- **Adoption:** public case studies, related-project links, and post-release
  discussion participation.

## What cannot be measured directly

Without opt-in telemetry, maintainers cannot directly know how many people
completed the quickstart, used a private corpus, trusted a score, or continued
using the package. Do not infer those facts from page views, download counts,
or stars.

## Interpretation rules

- Compare trends over a stated period rather than reacting to a single day.
- Segment bot or CI downloads where the registry makes that possible.
- Pair a growth signal with quality signals: package verification, a clear
  limitation record, and the nature of incoming reports.
- Never use a toy 9/9 result, the 113-case adapter parity record, or package
  downloads as a general quality, accuracy, or adoption claim.
