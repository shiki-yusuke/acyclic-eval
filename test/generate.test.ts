import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AcyclicEvalError } from "../src/errors.js";
import { generate } from "../src/generate.js";
import { readArtifact, readManifest } from "../src/manifest.js";
import { expectEquals } from "../src/types.js";
import type { Material, MutantCandidate, MutationOperator, ValidationResult } from "../src/types.js";

interface Source {
  readonly id: string;
  readonly value: number;
}
interface CaseInput {
  readonly value: number;
}

let outDir: string;

beforeEach(() => {
  outDir = mkdtempSync(path.join(tmpdir(), "acyclic-eval-generate-"));
});

afterEach(() => {
  rmSync(outDir, { recursive: true, force: true });
});

function selectAll(corpus: readonly Source[]): Material<Source>[] {
  return corpus.map((source) => ({ source, anchor: {} }));
}

function pass(): ValidationResult {
  return { valid: true };
}

const doublingOperator: MutationOperator<Source, CaseInput, number> = {
  id: "double",
  version: "1.0.0",
  selectMaterials: selectAll,
  mutate(material) {
    return [
      {
        caseId: "0",
        input: { value: material.source.value * 2 },
        target: { field: "value" },
        expected: expectEquals(material.source.value * 2),
        trace: {},
      },
    ];
  },
  selfValidate: pass,
};

describe("generate", () => {
  it("produces one manifest entry per structurally valid candidate", () => {
    const corpus: Source[] = [
      { id: "a", value: 1 },
      { id: "b", value: 2 },
    ];
    const result = generate(outDir, [doublingOperator], corpus);
    expect(result.manifest.entries).toHaveLength(2);
    const inputs = result.manifest.entries.map((e) => readArtifact<CaseInput>(outDir, e).value).sort();
    expect(inputs).toEqual([2, 4]);
  });

  it("handles an empty corpus without error, reporting zero selected materials", () => {
    const result = generate(outDir, [doublingOperator], []);
    expect(result.manifest.entries).toHaveLength(0);
    expect(result.operatorStats[0]!.materialsSelected).toBe(0);
    expect(result.operatorStats[0]!.candidatesGenerated).toBe(0);
  });

  it("produces deterministic output order across repeated runs of the same inputs", () => {
    const corpus: Source[] = [
      { id: "a", value: 1 },
      { id: "b", value: 2 },
      { id: "c", value: 3 },
    ];
    const outDir2 = mkdtempSync(path.join(tmpdir(), "acyclic-eval-generate-2-"));
    try {
      const r1 = generate(outDir, [doublingOperator], corpus);
      const r2 = generate(outDir2, [doublingOperator], corpus);
      expect(r1.manifest.entries.map((e) => e.caseId)).toEqual(r2.manifest.entries.map((e) => e.caseId));
    } finally {
      rmSync(outDir2, { recursive: true, force: true });
    }
  });

  it("skips a candidate whose selfValidate reports a no-op mutation, and records the reason in operatorStats", () => {
    const noopOperator: MutationOperator<Source, CaseInput, number> = {
      id: "noop",
      version: "1.0.0",
      selectMaterials: selectAll,
      mutate(material) {
        return [
          {
            caseId: "0",
            input: { value: material.source.value },
            target: { field: "value" },
            expected: expectEquals(material.source.value),
            trace: {},
          },
        ];
      },
      selfValidate(material, candidate): ValidationResult {
        if (candidate.input.value === material.source.value) {
          return { valid: false, reason: "no-op mutation: content unchanged" };
        }
        return { valid: true };
      },
    };

    const result = generate(outDir, [noopOperator], [{ id: "a", value: 1 }]);
    expect(result.manifest.entries).toHaveLength(0);
    expect(result.operatorStats[0]!.candidatesGenerated).toBe(1);
    expect(result.operatorStats[0]!.structurallyValid).toBe(0);
    expect(result.operatorStats[0]!.skipped[0]!.reason).toMatch(/no-op/);
  });

  it("skips a candidate with a missing target", () => {
    const missingTargetOperator: MutationOperator<Source, CaseInput, number> = {
      id: "missing-target",
      version: "1.0.0",
      selectMaterials: selectAll,
      mutate(material) {
        const candidate: MutantCandidate<CaseInput, number> = {
          caseId: "0",
          input: { value: material.source.value },
          target: undefined,
          expected: expectEquals(material.source.value),
          trace: {},
        };
        return [candidate];
      },
      selfValidate: pass,
    };

    const result = generate(outDir, [missingTargetOperator], [{ id: "a", value: 1 }]);
    expect(result.manifest.entries).toHaveLength(0);
    expect(result.operatorStats[0]!.skipped[0]!.reason).toMatch(/target/);
  });

  it("throws a clear error when one mutate() call returns two candidates with the same local caseId", () => {
    const duplicateOperator: MutationOperator<Source, CaseInput, number> = {
      id: "dup",
      version: "1.0.0",
      selectMaterials: selectAll,
      mutate(material) {
        return [
          { caseId: "same", input: { value: material.source.value }, target: {}, expected: expectEquals(1), trace: {} },
          { caseId: "same", input: { value: material.source.value + 1 }, target: {}, expected: expectEquals(2), trace: {} },
        ];
      },
      selfValidate: pass,
    };

    expect(() => generate(outDir, [duplicateOperator], [{ id: "a", value: 1 }])).toThrow(AcyclicEvalError);
    expect(() => generate(outDir, [duplicateOperator], [{ id: "a", value: 1 }])).toThrow(/same local caseId/);
  });

  it("produces stable caseIds that differ across materials with different source content", () => {
    const result = generate(
      outDir,
      [doublingOperator],
      [
        { id: "a", value: 1 },
        { id: "b", value: 2 },
      ],
    );
    const ids = result.manifest.entries.map((e) => e.caseId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("reports coverage stats for an operator that selects zero materials", () => {
    const neverOperator: MutationOperator<Source, CaseInput, number> = {
      id: "never",
      version: "1.0.0",
      selectMaterials: () => [],
      mutate: () => [],
      selfValidate: pass,
    };
    const result = generate(outDir, [neverOperator], [{ id: "a", value: 1 }]);
    expect(result.operatorStats[0]).toEqual({
      operatorId: "never",
      operatorVersion: "1.0.0",
      materialsSelected: 0,
      candidatesGenerated: 0,
      structurallyValid: 0,
      skipped: [],
    });
  });

  it("persists a manifest that readManifest can load back", () => {
    generate(outDir, [doublingOperator], [{ id: "a", value: 1 }]);
    const manifest = readManifest(outDir);
    expect(manifest.entries).toHaveLength(1);
  });
});
