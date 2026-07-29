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
  readonly mismatches: readonly CaseMismatch[];
  /** false when a coverage/pass-rate gate configured via ScoreOptions fails. */
  readonly pass: boolean;
}

export interface ScoreOptions<TExpected, TActual> {
  readonly metricAdapter?: MetricAdapter<TExpected, TActual>;
  /** Minimum `structurallyValid > 0` proportion of operators with materialsSelected > 0; also fails on any zero-generated operator when set. */
  readonly minCoverage?: number;
  readonly minPassRate?: number;
}
