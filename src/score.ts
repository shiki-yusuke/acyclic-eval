// score: (manifest, observations, comparator) -> report. Never calls a
// Judge -- swap in a different Comparator (or MetricAdapter) and re-score
// the exact same observations for free.

import { writeFileSync } from "node:fs";
import path from "node:path";
import { readObservations } from "./evaluate.js";
import { readManifest } from "./manifest.js";
import { formatReport } from "./report.js";
import type {
  CaseMismatch,
  Comparator,
  ConfusionMatrix,
  ExpectedSpec,
  ManifestEntry,
  Observation,
  OperatorCoverage,
  ScoreOptions,
  ScoreReport,
} from "./types.js";
import { CURRENT_SCHEMA_VERSION } from "./types.js";

interface EntryOutcome {
  readonly entry: ManifestEntry;
  readonly okCount: number;
  readonly infraErrorCount: number;
  readonly passCount: number;
  readonly lastActual?: unknown;
  readonly lastError?: string;
  readonly lastDetail?: string;
  readonly classifications: Array<"tp" | "tn" | "fp" | "fn">;
}

export function score<TExpected, TActual>(
  outDir: string,
  comparator: Comparator<TExpected, TActual>,
  options: ScoreOptions<TExpected, TActual> = {},
): ScoreReport {
  const manifest = readManifest(outDir);
  const observations = readObservations(outDir);

  const byCaseId = new Map<string, Observation[]>();
  for (const obs of observations) {
    const list = byCaseId.get(obs.caseId) ?? [];
    list.push(obs);
    byCaseId.set(obs.caseId, list);
  }

  const outcomes: EntryOutcome[] = manifest.entries.map((entry) => {
    const obsList = byCaseId.get(entry.caseId) ?? [];
    let okCount = 0;
    let infraErrorCount = 0;
    let passCount = 0;
    let lastActual: unknown;
    let lastError: string | undefined;
    let lastDetail: string | undefined;
    const classifications: Array<"tp" | "tn" | "fp" | "fn"> = [];

    for (const obs of obsList) {
      if (obs.status === "infra_error") {
        infraErrorCount += 1;
        lastError = obs.error;
        continue;
      }
      okCount += 1;
      lastActual = obs.actual;
      const comparison = comparator.compare(entry.expected as ExpectedSpec<TExpected>, obs.actual as TActual);
      lastDetail = comparison.detail;
      if (comparison.pass) passCount += 1;
      if (options.metricAdapter) {
        classifications.push(options.metricAdapter.classify(entry.expected as ExpectedSpec<TExpected>, obs.actual as TActual, comparison));
      }
    }

    return { entry, okCount, infraErrorCount, passCount, lastActual, lastError, lastDetail, classifications };
  });

  const byOperatorId = new Map<string, EntryOutcome[]>();
  for (const outcome of outcomes) {
    const list = byOperatorId.get(outcome.entry.operatorId) ?? [];
    list.push(outcome);
    byOperatorId.set(outcome.entry.operatorId, list);
  }

  const byOperator: OperatorCoverage[] = manifest.operatorStats.map((stats) => {
    const entryOutcomes = byOperatorId.get(stats.operatorId) ?? [];
    const evaluated = entryOutcomes.filter((o) => o.okCount > 0).length;
    const infraError = entryOutcomes.filter((o) => o.okCount === 0 && o.infraErrorCount > 0).length;
    const passed = entryOutcomes.filter((o) => o.okCount > 0 && o.passCount === o.okCount).length;
    return {
      operatorId: stats.operatorId,
      materialsSelected: stats.materialsSelected,
      candidatesGenerated: stats.candidatesGenerated,
      structurallyValid: stats.structurallyValid,
      evaluated,
      infraError,
      passed,
      passRate: evaluated === 0 ? 0 : passed / evaluated,
    };
  });

  const totalEvaluated = outcomes.filter((o) => o.okCount > 0).length;
  const totalInfraError = outcomes.filter((o) => o.okCount === 0 && o.infraErrorCount > 0).length;
  const totalPassed = outcomes.filter((o) => o.okCount > 0 && o.passCount === o.okCount).length;

  const coverageWarnings: string[] = [];
  for (const stats of manifest.operatorStats) {
    if (stats.materialsSelected === 0) {
      coverageWarnings.push(`operator "${stats.operatorId}" selected 0 materials from the corpus (no coverage at all)`);
    } else if (stats.candidatesGenerated === 0) {
      coverageWarnings.push(`operator "${stats.operatorId}" selected materials but generated 0 candidates`);
    } else if (stats.structurallyValid === 0) {
      coverageWarnings.push(`operator "${stats.operatorId}" generated candidates but all of them failed selfValidate`);
    }
  }

  let confusionMatrix: ConfusionMatrix | undefined;
  if (options.metricAdapter) {
    let tp = 0;
    let tn = 0;
    let fp = 0;
    let fn = 0;
    for (const outcome of outcomes) {
      for (const c of outcome.classifications) {
        if (c === "tp") tp += 1;
        else if (c === "tn") tn += 1;
        else if (c === "fp") fp += 1;
        else fn += 1;
      }
    }
    confusionMatrix = {
      tp,
      tn,
      fp,
      fn,
      precision: tp + fp === 0 ? null : tp / (tp + fp),
      recall: tp + fn === 0 ? null : tp / (tp + fn),
    };
  }

  const mismatches: CaseMismatch[] = outcomes
    .filter((o) => o.okCount > 0 && o.passCount < o.okCount)
    .map((o) => ({
      caseId: o.entry.caseId,
      operatorId: o.entry.operatorId,
      target: o.entry.target,
      expected: o.entry.expected,
      actual: o.lastActual,
      error: o.lastError,
      detail: o.lastDetail,
    }));

  const operatorsWithCoverage = byOperator.filter((o) => o.structurallyValid > 0).length;
  const coverageRatio = byOperator.length === 0 ? 1 : operatorsWithCoverage / byOperator.length;
  const overallPassRate = totalEvaluated === 0 ? 0 : totalPassed / totalEvaluated;

  let pass = true;
  if (options.minCoverage !== undefined && coverageRatio < options.minCoverage) pass = false;
  if (options.minPassRate !== undefined && overallPassRate < options.minPassRate) pass = false;

  const report: ScoreReport = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    scoredAt: new Date().toISOString(),
    overall: {
      totalCases: manifest.entries.length,
      evaluated: totalEvaluated,
      infraError: totalInfraError,
      passed: totalPassed,
      passRate: overallPassRate,
    },
    byOperator,
    confusionMatrix,
    coverageWarnings,
    mismatches,
    pass,
  };

  const { json, markdown } = formatReport(report);
  writeFileSync(path.join(outDir, "report.json"), json);
  writeFileSync(path.join(outDir, "report.md"), markdown);

  return report;
}
