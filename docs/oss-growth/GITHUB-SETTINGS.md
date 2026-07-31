# Recommended GitHub settings — acyclic-eval

These are manual GitHub settings; this repository does not change them.

## Repository metadata

| Setting | Recommendation |
| --- | --- |
| Description | Evaluate LLM and rule-based judges with mutation cases generated independently of the judge under test. |
| Website | `https://github.com/shiki-yusuke/acyclic-eval#readme` until a maintained documentation site has a clear need. |
| Topics | `llm-evaluation`, `llm-as-a-judge`, `mutation-testing`, `evaluation-framework`, `ai-agents`, `testing`, `typescript`, `cli` |
| Social preview copy | **acyclic-eval** — Evaluate a judge without letting that judge influence its own mutation cases. Generate independently, record evidence, re-score transparently. |

Only add tool-specific topics after the repository gains and documents the
corresponding adapter. The core does not itself implement Claude Code or Codex
CLI integrations, so those names are not recommended topics for this repository.

## Portfolio placement

Pin `acyclic-eval` on the GitHub profile when explaining the evaluation layer
of the Evidence-First AI Coding Toolkit. A readable pin sequence is:

```text
agent-cost -> evigate -> acyclic-eval -> spec-lane -> ai-agent-skills-playbook
```

Each tool remains independently usable; pins should not imply a required
installation order.

## Community and site decisions

| Setting | Recommendation | Reason |
| --- | --- | --- |
| GitHub Discussions | Enable | Adapter design, corpus provenance, and non-circularity questions are often exploratory and do not fit issue forms. |
| GitHub Pages | Do not enable initially | The README and versioned docs are the source of truth. Reconsider only when a maintained guides/API site has a defined owner. |
| Social preview image | Set manually | Use the copy above with a three-role generation/Judge/comparator diagram; include no terminal paths, transcripts, credentials, or unqualified accuracy numbers. |
