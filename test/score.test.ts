import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { digestOfValue } from "../src/digest.js";
import { AcyclicEvalError } from "../src/errors.js";
import { generate } from "../src/generate.js";
import { readArtifact } from "../src/manifest.js";
import { score } from "../src/score.js";
import { expectEquals, expectForbid, expectOneOf } from "../src/types.js";
import type {
  Comparator,
  ExpectedSpec,
  ManifestEntry,
  Material,
  MetricAdapter,
  MutationOperator,
  Observation,
  ValidationResult,
} from "../src/types.js";

interface Source {
  readonly id: string;
  readonly expected: ExpectedSpec<string>;
}
interface CaseInput {
  readonly tag: string;
}

function pass(): ValidationResult {
  return { valid: true };
}

const multiOperator: MutationOperator<Source, CaseInput, string> = {
  id: "multi",
  version: "1.0.0",
  selectMaterials: (corpus: readonly Source[]): Material<Source>[] => corpus.map((source) => ({ source, anchor: {} })),
  mutate(material) {
    return [
      {
        caseId: "0",
        input: { tag: material.source.id },
        target: { id: material.source.id },
        expected: material.source.expected,
        trace: {},
      },
    ];
  },
  selfValidate: pass,
};

const comparator: Comparator<string, string> = {
  id: "test-comparator",
  version: "1.0.0",
  compare(expected, actual) {
    if (expected.kind === "equals") return { pass: actual === expected.value };
    if (expected.kind === "oneOf") return { pass: expected.values.includes(actual) };
    return { pass: !expected.values.includes(actual) };
  },
};

const corpus: Source[] = [
  { id: "eq-pass", expected: expectEquals("X") },
  { id: "eq-fail", expected: expectEquals("X") },
  { id: "oneof-pass", expected: expectOneOf(["A", "B"]) },
  { id: "forbid-pass", expected: expectForbid(["Z"]) },
  { id: "forbid-fail", expected: expectForbid(["Z"]) },
];

const actualById: Record<string, string> = {
  "eq-pass": "X",
  "eq-fail": "Y",
  "oneof-pass": "B",
  "forbid-pass": "W",
  "forbid-fail": "Z",
};

let outDir: string;

// Writes observations with the *real* inputDigest of each entry's current artifact --
// score() now cross-checks recorded inputDigest against a fresh read of the artifact
// (tamper detection at score time), so a placeholder digest would make every test here
// throw rather than exercise what it's meant to test.
function writeRealObservations(dir: string, entries: readonly ManifestEntry[]): void {
  const lines = entries.map((entry) => {
    const input = readArtifact(dir, entry);
    const obs: Observation = {
      caseId: entry.caseId,
      sampleIndex: 0,
      attempts: 1,
      judgeId: "manual",
      inputDigest: digestOfValue(input),
      latencyMs: 1,
      timestamp: new Date().toISOString(),
      status: "ok",
      actual: actualById[(entry.target as { id: string }).id]!,
    };
    return JSON.stringify(obs);
  });
  writeFileSync(path.join(dir, "observations.jsonl"), lines.length > 0 ? `${lines.join("\n")}\n` : "");
}

beforeEach(() => {
  outDir = mkdtempSync(path.join(tmpdir(), "acyclic-eval-score-"));
  const result = generate(outDir, [multiOperator], corpus);
  writeRealObservations(outDir, result.manifest.entries);
});

afterEach(() => {
  rmSync(outDir, { recursive: true, force: true });
});

describe("score: equals / oneOf / forbid", () => {
  it("scores all three ExpectedSpec kinds correctly", () => {
    const report = score(outDir, comparator);
    expect(report.overall.evaluated).toBe(5);
    expect(report.overall.passed).toBe(3);
    expect(report.mismatches.map((m) => (m.target as { id: string }).id)).toEqual(["eq-fail", "forbid-fail"]);
  });

  it("produces a deterministic report across repeated scoring of the same data", () => {
    const r1 = score(outDir, comparator);
    const r2 = score(outDir, comparator);
    expect(r1.byOperator).toEqual(r2.byOperator);
    expect(r1.mismatches.map((m) => m.caseId)).toEqual(r2.mismatches.map((m) => m.caseId));
  });
});

describe("score: coverage warnings", () => {
  it("flags an operator that selected zero materials", () => {
    const zeroOutDir = mkdtempSync(path.join(tmpdir(), "acyclic-eval-score-zero-"));
    try {
      const neverOperator: MutationOperator<Source, CaseInput, string> = {
        id: "never",
        version: "1.0.0",
        selectMaterials: () => [],
        mutate: () => [],
        selfValidate: pass,
      };
      generate(zeroOutDir, [neverOperator], corpus);
      writeFileSync(path.join(zeroOutDir, "observations.jsonl"), "");
      const report = score(zeroOutDir, comparator);
      expect(report.coverageWarnings.some((w) => w.includes("never") && w.includes("selected 0 materials"))).toBe(true);
    } finally {
      rmSync(zeroOutDir, { recursive: true, force: true });
    }
  });

  it("flags an operator whose candidates all failed selfValidate, distinctly from zero-generated", () => {
    const invalidOutDir = mkdtempSync(path.join(tmpdir(), "acyclic-eval-score-invalid-"));
    try {
      const alwaysInvalidOperator: MutationOperator<Source, CaseInput, string> = {
        id: "always-invalid",
        version: "1.0.0",
        selectMaterials: (c) => c.map((source) => ({ source, anchor: {} })),
        mutate: (material) => [
          { caseId: "0", input: { tag: material.source.id }, target: {}, expected: expectEquals("X"), trace: {} },
        ],
        selfValidate: () => ({ valid: false, reason: "always invalid for this test" }),
      };
      generate(invalidOutDir, [alwaysInvalidOperator], corpus);
      writeFileSync(path.join(invalidOutDir, "observations.jsonl"), "");
      const report = score(invalidOutDir, comparator);
      expect(report.coverageWarnings.some((w) => w.includes("always-invalid") && w.includes("failed selfValidate"))).toBe(true);
    } finally {
      rmSync(invalidOutDir, { recursive: true, force: true });
    }
  });
});

describe("score: gates", () => {
  it("passes when no gate options are set, regardless of coverage/pass rate", () => {
    const report = score(outDir, comparator);
    expect(report.pass).toBe(true); // 3/5 pass rate, no gate configured
  });

  it("fails the gate when minPassRate is higher than the observed pass rate", () => {
    const report = score(outDir, comparator, { minPassRate: 0.9 });
    expect(report.pass).toBe(false);
  });

  it("fails the gate when minCoverage requires full operator coverage and one operator has none", () => {
    const outDir2 = mkdtempSync(path.join(tmpdir(), "acyclic-eval-score-gate2-"));
    try {
      const neverOperator: MutationOperator<Source, CaseInput, string> = {
        id: "never",
        version: "1.0.0",
        selectMaterials: () => [],
        mutate: () => [],
        selfValidate: pass,
      };
      const entries = generate(outDir2, [multiOperator, neverOperator], corpus).manifest.entries;
      writeRealObservations(outDir2, entries);
      const report = score(outDir2, comparator, { minCoverage: 1 });
      expect(report.pass).toBe(false);
    } finally {
      rmSync(outDir2, { recursive: true, force: true });
    }
  });
});

describe("score: confusion matrix via MetricAdapter", () => {
  it("classifies tp/tn/fp/fn using a domain-supplied MetricAdapter", () => {
    const metricAdapter: MetricAdapter<string, string> = {
      id: "equals-is-positive",
      isPositive: (expected) => expected.kind === "equals",
      classify(expected, _actual, comparison) {
        const positive = metricAdapter.isPositive(expected);
        if (positive) return comparison.pass ? "tp" : "fn";
        return comparison.pass ? "tn" : "fp";
      },
    };
    const report = score(outDir, comparator, { metricAdapter });
    expect(report.confusionMatrix).toEqual({ tp: 1, tn: 2, fp: 1, fn: 1, precision: 0.5, recall: 0.5 });
  });

  it("reports null precision/recall when the denominator is zero (no MetricAdapter positives or false positives at all)", () => {
    const alwaysNegativeAdapter: MetricAdapter<string, string> = {
      id: "always-tn",
      isPositive: () => false,
      classify: () => "tn",
    };
    const report = score(outDir, comparator, { metricAdapter: alwaysNegativeAdapter });
    expect(report.confusionMatrix).toEqual({ tp: 0, tn: 5, fp: 0, fn: 0, precision: null, recall: null });
  });
});

describe("score: observations.jsonl integrity", () => {
  it("reports a torn trailing observation as a data quality warning instead of silently dropping it or throwing", () => {
    const content = readFileSync(path.join(outDir, "observations.jsonl"), "utf8");
    const withTornTail = `${content.trimEnd()}\n{"caseId":"garbage-not-clos`; // no trailing newline
    writeFileSync(path.join(outDir, "observations.jsonl"), withTornTail);

    const report = score(outDir, comparator);
    expect(report.dataQualityWarnings.length).toBeGreaterThan(0);
    expect(report.dataQualityWarnings[0]).toMatch(/incomplete trailing write/);
  });

  it("throws on non-tail corruption in observations.jsonl rather than silently under-reporting", () => {
    writeFileSync(path.join(outDir, "observations.jsonl"), "not json\nmore not json\n");
    expect(() => score(outDir, comparator)).toThrow(AcyclicEvalError);
  });

  it("throws when a case's artifact was modified after the observation referencing it was recorded", () => {
    const entries = generate(outDir, [multiOperator], corpus).manifest.entries;
    writeRealObservations(outDir, entries);
    // Tamper with one artifact file directly, after observations were recorded against the
    // original content -- readArtifact's own digest check would also catch this, but here we
    // specifically exercise score()'s independent inputDigest cross-check.
    const target = entries[0]!;
    const artifactPath = path.join(outDir, target.artifactUri);
    writeFileSync(artifactPath, JSON.stringify({ tag: "tampered-after-the-fact" }, null, 2));

    expect(() => score(outDir, comparator)).toThrow(AcyclicEvalError);
    expect(() => score(outDir, comparator)).toThrow(/tamper detected/);
  });
});

describe("score: empty manifest", () => {
  it("scores an empty manifest without error", () => {
    const emptyOutDir = mkdtempSync(path.join(tmpdir(), "acyclic-eval-score-empty-"));
    try {
      generate(emptyOutDir, [multiOperator], []);
      writeFileSync(path.join(emptyOutDir, "observations.jsonl"), "");
      const report = score(emptyOutDir, comparator);
      expect(report.overall.totalCases).toBe(0);
      expect(report.overall.evaluated).toBe(0);
      expect(report.overall.passRate).toBe(0);
    } finally {
      rmSync(emptyOutDir, { recursive: true, force: true });
    }
  });
});
