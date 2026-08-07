# Evidence-First AI Coding Toolkit — content roadmap

Write one evidence-first article at a time. Each article should lead with a
failure mode, decision, or evaluation method; it should not be a release
announcement. Link only to the tool that genuinely helps the reader next.

| Order | Working title | Primary repository | Useful reader outcome |
| ---: | --- | --- | --- |
| 1 | Claude Code / Codex CLIのトークン使用量をローカルログから測る | [agent-cost](https://github.com/shiki-yusuke/agent-cost) | Separate observed usage from estimated cost. |
| 2 | AIエージェントの「テスト成功」を信用せず、実行証拠と照合する | [evigate](https://github.com/shiki-yusuke/evigate) | Compare completion claims with commands, tests, and edits. |
| 3 | LLM Judgeの評価にJudge自身を使うと何が起きるか | [acyclic-eval](https://github.com/shiki-yusuke/acyclic-eval) | Recognize circular case selection and three-role separation. |
| 4 | AI開発フローにHuman Gateを残す理由 | [spec-lane](https://github.com/shiki-yusuke/spec-lane) | Identify decisions that should remain reviewable. |
| 5 | 仕様書をAIが読める形でコード・テスト・ログへ接続する | [spec-impact-analyzer](https://github.com/shiki-yusuke/spec-impact-analyzer) | Use a case study to reason about specification impact. |
| 6 | AI支援開発のコスト推定を実績でcalibrationする | [agent-cost](https://github.com/shiki-yusuke/agent-cost) | Explain estimate uncertainty and later calibration. |
| 7 | unknownを無理に成功・失敗へ分類しない設計 | [acyclic-eval](https://github.com/shiki-yusuke/acyclic-eval) | Preserve uncertainty and route it to human review. |
| 8 | ローカルファーストなAI開発ツールを作る際のプライバシー設計 | [ai-agent-skills-playbook](https://github.com/shiki-yusuke/ai-agent-skills-playbook) and acyclic-eval | Design redaction and no-default-telemetry paths. |

## Launch order

Do not launch these projects as a single bundle. Publish and learn from each
individually in this order:

1. `agent-cost`
2. `evigate`
3. `acyclic-eval`
4. `spec-lane`
5. `ai-agent-skills-playbook`
6. `spec-impact-analyzer` case-study article

For the acyclic-eval article, include the 9-case toy command, explain that it
is not a benchmark, describe the documented 113-case adapter-parity scope, and
ask for critique of the threat model and operator design.
