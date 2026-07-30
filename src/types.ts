// Core type system for acyclic-eval.
//
// Three separate roles are kept intentionally apart so that a mutation
// operator can never see (and therefore can never depend on) the judge under
// evaluation:
//
//   MutationOperator  -- generates candidate cases from a corpus of source
//                        material. Only structural information flows in
//                        (selectMaterials/mutate/selfValidate never receive a
//                        Judge instance or its output).
//   Judge             -- the thing being evaluated. It only ever sees a
//                        TCaseInput, never the expected value or any
//                        provenance metadata (operator id, tags, ...).
//   Comparator        -- turns (expected, actual) into a pass/fail verdict.
//                        It is swappable after the fact so that a report can
//                        be re-scored without re-running the judge.

export type SchemaVersion = 1;

export const CURRENT_SCHEMA_VERSION: SchemaVersion = 1;

/**
 * A single expected-value assertion. `equals` pins down one value; `oneOf`
 * accepts any of a set of values (useful when the "correct" outcome isn't
 * unique, e.g. several unknown-labels are all acceptable); `forbid` asserts
 * that none of the listed values may occur (useful for precision-side
 * operators where the only thing that matters is "must not regress to X").
 */
export type ExpectedSpec<TExpected> =
  | { kind: "equals"; value: TExpected }
  | { kind: "oneOf"; values: TExpected[] }
  | { kind: "forbid"; values: TExpected[] };

export function expectEquals<TExpected>(value: TExpected): ExpectedSpec<TExpected> {
  return { kind: "equals", value };
}

export function expectOneOf<TExpected>(values: TExpected[]): ExpectedSpec<TExpected> {
  return { kind: "oneOf", values };
}

export function expectForbid<TExpected>(values: TExpected[]): ExpectedSpec<TExpected> {
  return { kind: "forbid", values };
}

/**
 * Generation-time-only context: the original source item plus whatever
 * structural anchor the operator needs (e.g. a parsed block index). Never
 * persisted -- only `MutantCandidate`/`ManifestEntry` survive past
 * generation.
 */
export interface Material<TSource> {
  readonly source: TSource;
  readonly anchor: Readonly<Record<string, unknown>>;
}

/**
 * Generation-time-only evaluation case. `caseId` only needs to be unique
 * among the candidates a single `mutate()` call returns for one material;
 * the generate pipeline combines it with the operator id/version and a
 * digest of the source material to build the globally unique id stored in
 * `ManifestEntry.caseId`.
 */
export interface MutantCandidate<TCaseInput, TExpected> {
  readonly caseId: string;
  readonly input: TCaseInput;
  /** What structural element of `input` this case targets. Must not be undefined. */
  readonly target: unknown;
  readonly expected: ExpectedSpec<TExpected>;
  /** Free-form generation trace, useful for debugging and reports; never fed to a Judge. */
  readonly trace: Readonly<Record<string, unknown>>;
  readonly tags?: readonly string[];
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly reason?: string;
}

export interface MutationOperator<TSource, TCaseInput, TExpected> {
  /** Stable id, used as part of the caseId and in reports. Must not change across versions. */
  readonly id: string;
  readonly version: string;
  /** Structural query only -- must not consult a Judge or its output. */
  selectMaterials(corpus: readonly TSource[]): Material<TSource>[];
  mutate(material: Material<TSource>): MutantCandidate<TCaseInput, TExpected>[];
  /**
   * Structural self-check only (parseable, content actually changed relative
   * to `material.source`, target present, ...). Must not compare against a
   * Judge's verdict -- doing so would silently exclude the very mutants that
   * would expose a buggy Judge.
   */
  selfValidate(material: Material<TSource>, candidate: MutantCandidate<TCaseInput, TExpected>): ValidationResult;
}

export interface JudgeContext {
  readonly signal?: AbortSignal;
  readonly sampleIndex: number;
}

export interface Judge<TCaseInput, TActual> {
  readonly id: string;
  readonly version?: string;
  /**
   * `ctx.signal` fires when `evaluate()`'s configured `timeoutMs` elapses.
   * Honoring it (aborting whatever request/computation is in flight) is
   * the judge's responsibility, not something acyclic-eval can force: a
   * judge that ignores `ctx.signal` keeps running in the background after
   * the runner has already given up on it and recorded a timeout failure.
   * Its eventual result is discarded, but real (not just reported)
   * concurrency can exceed the configured `concurrency` limit until it
   * settles -- see docs/threat-model.md's "non-cooperative abort" section.
   */
  evaluate(input: TCaseInput, ctx: JudgeContext): Promise<TActual> | TActual;
}

export interface ComparisonResult {
  readonly pass: boolean;
  readonly category?: string;
  readonly detail?: string;
}

export interface Comparator<TExpected, TActual> {
  readonly id: string;
  readonly version: string;
  compare(expected: ExpectedSpec<TExpected>, actual: TActual): ComparisonResult;
}

/**
 * Optional, domain-supplied definition of "positive class" and confusion
 * matrix bucketing. The core never hardcodes what recall/precision mean --
 * without a MetricAdapter, score() only reports plain pass/fail counts.
 */
export interface MetricAdapter<TExpected, TActual> {
  readonly id: string;
  isPositive(expected: ExpectedSpec<TExpected>): boolean;
  classify(expected: ExpectedSpec<TExpected>, actual: TActual, comparison: ComparisonResult): "tp" | "tn" | "fp" | "fn";
}

/**
 * JSON-compatible, immutable persistence protocol. TCaseInput is never
 * inlined here -- it lives in a content-addressed artifact file referenced
 * by `artifactUri`/`artifactDigest`, so tampering with the generated case
 * after the fact is detectable.
 */
export interface ManifestEntry {
  readonly schemaVersion: SchemaVersion;
  readonly caseId: string;
  readonly operatorId: string;
  readonly operatorVersion: string;
  readonly artifactUri: string;
  readonly artifactDigest: string;
  readonly sourceDigest: string;
  readonly target: unknown;
  readonly expected: ExpectedSpec<unknown>;
  readonly tags: readonly string[];
}

export interface GenerationOperatorStats {
  readonly operatorId: string;
  readonly operatorVersion: string;
  readonly materialsSelected: number;
  readonly candidatesGenerated: number;
  readonly structurallyValid: number;
  readonly skipped: ReadonlyArray<{ readonly caseId?: string; readonly reason: string }>;
}

export interface Manifest {
  readonly schemaVersion: SchemaVersion;
  readonly generatedAt: string;
  readonly entries: readonly ManifestEntry[];
  readonly operatorStats: readonly GenerationOperatorStats[];
}

/** Raw judge observation for one (case, sample). Never re-derives a verdict -- that's score()'s job. */
export interface Observation {
  readonly caseId: string;
  readonly sampleIndex: number;
  /** Number of attempts consumed (>1 means retries happened before this outcome). Distinct from sampleIndex/repetition. */
  readonly attempts: number;
  readonly judgeId: string;
  readonly judgeVersion?: string;
  readonly inputDigest: string;
  readonly latencyMs: number;
  readonly timestamp: string;
  readonly status: "ok" | "infra_error";
  readonly actual?: unknown;
  readonly error?: string;
}

export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly backoffMs: number;
}

export interface RunnerOptions {
  readonly concurrency?: number;
  readonly samples?: number;
  readonly timeoutMs?: number;
  readonly retry?: Partial<RetryPolicy>;
  readonly resume?: boolean;
}

export interface EvaluateSummary {
  readonly totalCases: number;
  readonly totalSamples: number;
  readonly ranSamples: number;
  readonly skippedResumedSamples: number;
  /**
   * Samples that had a prior recorded observation but were re-run anyway
   * because the case's artifact hashes differently now than when that
   * observation was recorded (e.g. the artifact was regenerated or
   * modified between evaluate() runs). These are included in `ranSamples`,
   * not `skippedResumedSamples`.
   */
  readonly staleObservationsInvalidated: number;
  readonly okSamples: number;
  readonly infraErrorSamples: number;
}

export interface OperatorCoverage {
  readonly operatorId: string;
  readonly materialsSelected: number;
  readonly candidatesGenerated: number;
  readonly structurallyValid: number;
  readonly evaluated: number;
  readonly infraError: number;
  readonly passed: number;
  readonly passRate: number;
}

export interface ConfusionMatrix {
  readonly tp: number;
  readonly tn: number;
  readonly fp: number;
  readonly fn: number;
  readonly precision: number | null;
  readonly recall: number | null;
}

export interface CaseMismatch {
  readonly caseId: string;
  readonly operatorId: string;
  readonly target: unknown;
  readonly expected: ExpectedSpec<unknown>;
  readonly actual?: unknown;
  readonly error?: string;
  readonly detail?: string;
}

export interface ScoreReport {
  readonly schemaVersion: SchemaVersion;
  readonly scoredAt: string;
  readonly overall: {
    readonly totalCases: number;
    readonly evaluated: number;
    readonly infraError: number;
    readonly passed: number;
    readonly passRate: number;
  };
  readonly byOperator: readonly OperatorCoverage[];
  readonly confusionMatrix?: ConfusionMatrix;
  readonly coverageWarnings: readonly string[];
  /**
   * Non-fatal integrity notes about observations.jsonl itself (e.g. a torn
   * trailing write from an interrupted evaluate() run was ignored). Distinct
   * from coverageWarnings, which are about operator coverage, not file
   * integrity. Non-tail corruption is never reported here -- it's a thrown
   * AcyclicEvalError instead, since silently dropping it would be worse than
   * refusing to score.
   */
  readonly dataQualityWarnings: readonly string[];
  readonly mismatches: readonly CaseMismatch[];
  /** false when a coverage/pass-rate gate configured via ScoreOptions fails. */
  readonly pass: boolean;
}

export interface ScoreOptions<TExpected, TActual> {
  readonly metricAdapter?: MetricAdapter<TExpected, TActual>;
  /**
   * Minimum required value (0..1) of `coverageRatio = (# operators with
   * structurallyValid > 0) / (total # operators in the manifest)`. Setting
   * this to `1` means every operator in the pipeline must have produced at
   * least one structurally-valid case, or the gate fails. Operators that
   * selected zero materials still count in the denominator (and count
   * against the ratio), so a corpus that doesn't exercise every operator
   * will correctly fail this gate rather than being averaged away.
   */
  readonly minCoverage?: number;
  readonly minPassRate?: number;
}

/**
 * Config module contract for the CLI. Each piece is its own async function
 * rather than a single flat object so that `acyclic-eval generate` never has
 * to import (even transitively) whatever `evaluateConfig()` pulls in to
 * build a Judge -- see docs/threat-model.md's "process/entry-point
 * separation" section. A config module only needs to export the function(s)
 * the subcommands you actually run require.
 */
export interface GenerateConfig<TSource, TCaseInput, TExpected> {
  readonly corpus: readonly TSource[];
  readonly operators: ReadonlyArray<MutationOperator<TSource, TCaseInput, TExpected>>;
}

export interface EvaluateConfig<TCaseInput, TActual> {
  readonly judge: Judge<TCaseInput, TActual>;
}

export interface ScoreConfig<TExpected, TActual> {
  readonly comparator: Comparator<TExpected, TActual>;
  readonly metricAdapter?: MetricAdapter<TExpected, TActual>;
}
