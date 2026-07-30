// score: (manifest, observations, comparator) -> report. Never calls a
// Judge -- swap in a different Comparator (or MetricAdapter) and re-score
// the exact same observations for free.

import { writeFileSync } from "node:fs";
import path from "node:path";
import { digestOfValue } from "./digest.js";
import { AcyclicEvalError } from "./errors.js";
import { readObservations } from "./evaluate.js";
import { readArtifact, readManifest } from "./manifest.js";
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
  const { observations, tornTailDropped } = readObservations(outDir);
  const dataQualityWarnings: string[] = tornTailDropped
    ? [
        "observations.jsonl had an incomplete trailing write (consistent with an interrupted " +
          "evaluate() run) that was ignored. Re-run evaluate() with resume enabled to fill in the " +
          "missing sample before trusting this report's coverage.",
      ]
    : [];

  // Observations recorded by more than one distinct judge identity would silently blend two
  // different judges' results into one report -- never resolved automatically, no override flag.
  const judgeIdentities = new Set(observations.map((obs) => `${obs.judgeId}@${obs.judgeVersion ?? ""}`));
  if (judgeIdentities.size > 1) {
    throw new AcyclicEvalError(
      `observations.jsonl contains ${judgeIdentities.size} distinct judge identities ` +
        `(${[...judgeIdentities].sort().join(", ")}). Scoring observations from more than one judge as a single ` +
        `report would silently blend their results. Re-run evaluate() with resume: false against a single judge, ` +
        `or split observations.jsonl by judge identity before scoring.`,
    );
  }

  const byCaseId = new Map<string, Observation[]>();
  for (const obs of observations) {
    const list = byCaseId.get(obs.caseId) ?? [];
    list.push(obs);
    byCaseId.set(obs.caseId, list);
  }

  // Re-verify every case that was actually evaluated against what's on disk *right now*.
  // readArtifact() itself throws if the artifact's bytes no longer match the manifest's
  // artifactDigest; comparing against each observation's recorded inputDigest additionally
  // catches an artifact that was modified *after* evaluate() ran but still happens to match
  // some (different) valid-looking content -- i.e. this is what actually makes good on the
  // "evaluate/score can detect tampering" claim in docs/threat-model.md, not just evaluate().
  for (const entry of manifest.entries) {
    const obsForEntry = byCaseId.get(entry.caseId);
    if (!obsForEntry || obsForEntry.length === 0) continue;
    const currentInput = readArtifact<unknown>(outDir, entry);
    const currentInputDigest = digestOfValue(currentInput);
    for (const obs of obsForEntry) {
      if (obs.status !== "ok") continue;
      if (obs.inputDigest !== currentInputDigest) {
        throw new AcyclicEvalError(
          `tamper detected: case ${entry.caseId} (sample ${obs.sampleIndex}) was evaluated against a ` +
            `different input than what is currently on disk (recorded inputDigest ${obs.inputDigest}, ` +
            `current artifact hashes to ${currentInputDigest}). Refusing to score a possibly-modified ` +
            `case -- re-run evaluate() against the current artifact.`,
        );
      }
    }
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

  // Denominator is every operator in the manifest, not just the ones with materialsSelected > 0
  // -- a zero-coverage operator must pull this ratio down, not be excluded from it (see
  // ScoreOptions.minCoverage's doc comment in types.ts).
  const operatorsWithCoverage = byOperator.filter((o) => o.structurallyValid > 0).length;
  const coverageRatio = byOperator.length === 0 ? 1 : operatorsWithCoverage / byOperator.length;
  const overallPassRate = totalEvaluated === 0 ? 0 : totalPassed / totalEvaluated;

  let pass = true;
  if (options.minCoverage !== undefined && coverageRatio < options.minCoverage) pass = false;
  if (options.minPassRate !== undefined && overallPassRate < options.minPassRate) pass = false;
  if (options.allowZeroGenerated !== undefined) {
    const allowed = new Set(options.allowZeroGenerated);
    for (const op of byOperator) {
      if (op.structurallyValid === 0 && !allowed.has(op.operatorId)) pass = false;
    }
  }

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
    dataQualityWarnings,
    mismatches,
    pass,
  };

  const { json, markdown } = formatReport(report);
  writeFileSync(path.join(outDir, "report.json"), json);
  writeFileSync(path.join(outDir, "report.md"), markdown);

  return report;
}
