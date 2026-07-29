// Renders a ScoreReport as JSON + Markdown. Deliberately domain-agnostic --
// unlike evigate's formatEvalReport (which knew about verdicts/reason
// codes), this only knows about pass/fail counts, coverage, and an optional
// confusion matrix.

import type { ScoreReport } from "./types.js";

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function formatReport(report: ScoreReport): { json: string; markdown: string } {
  const lines: string[] = [];
  lines.push("# acyclic-eval report", "");
  lines.push(`_scored at ${report.scoredAt}_`, "");
  lines.push(
    `- overall: ${report.overall.passed}/${report.overall.evaluated} passed (${pct(report.overall.passRate)}), ` +
      `${report.overall.infraError} infra errors, ${report.overall.totalCases} total cases`,
  );
  lines.push(`- gate: ${report.pass ? "PASS" : "FAIL"}`, "");

  if (report.coverageWarnings.length > 0) {
    lines.push("## Coverage warnings", "");
    for (const w of report.coverageWarnings) lines.push(`- ${w}`);
    lines.push("");
  }

  lines.push("## By operator", "");
  lines.push("| operator | selected | generated | valid | evaluated | infra_error | passed | pass rate |");
  lines.push("|---|---|---|---|---|---|---|---|");
  for (const op of report.byOperator) {
    lines.push(
      `| ${op.operatorId} | ${op.materialsSelected} | ${op.candidatesGenerated} | ${op.structurallyValid} | ` +
        `${op.evaluated} | ${op.infraError} | ${op.passed} | ${pct(op.passRate)} |`,
    );
  }
  lines.push("");

  if (report.confusionMatrix) {
    const cm = report.confusionMatrix;
    lines.push("## Confusion matrix", "");
    lines.push(`- tp=${cm.tp} tn=${cm.tn} fp=${cm.fp} fn=${cm.fn}`);
    lines.push(`- precision: ${cm.precision === null ? "n/a" : pct(cm.precision)}`);
    lines.push(`- recall: ${cm.recall === null ? "n/a" : pct(cm.recall)}`);
    lines.push("");
  }

  if (report.mismatches.length > 0) {
    lines.push("## Mismatches", "");
    for (const m of report.mismatches) {
      lines.push(`### ${m.caseId}`, "");
      lines.push(`- operator: ${m.operatorId}`);
      lines.push(`- expected: \`${JSON.stringify(m.expected)}\``);
      lines.push(`- actual: \`${m.actual === undefined ? "(none)" : JSON.stringify(m.actual)}\``);
      if (m.error) lines.push(`- error: ${m.error}`);
      if (m.detail) lines.push(`- detail: ${m.detail}`);
      lines.push("");
    }
  }

  return { json: JSON.stringify(report, null, 2), markdown: lines.join("\n") };
}
