import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AcyclicEvalError } from "../src/errors.js";
import { artifactRelPath, readArtifact, readManifest, resolveArtifactPath, writeArtifact, writeManifest } from "../src/manifest.js";
import type { ManifestEntry } from "../src/types.js";

let outDir: string;

beforeEach(() => {
  outDir = mkdtempSync(path.join(tmpdir(), "acyclic-eval-manifest-"));
});

afterEach(() => {
  rmSync(outDir, { recursive: true, force: true });
});

function makeEntry(overrides: Partial<ManifestEntry> = {}): ManifestEntry {
  return {
    schemaVersion: 1,
    caseId: "op@1.0.0:abc:0",
    operatorId: "op",
    operatorVersion: "1.0.0",
    artifactUri: "artifacts/op@1.0.0:abc:0.json",
    artifactDigest: "deadbeef",
    sourceDigest: "abc",
    target: { commandIndex: 0 },
    expected: { kind: "equals", value: "pass" },
    tags: [],
    ...overrides,
  };
}

describe("manifest round-trip", () => {
  it("writes and reads back an equivalent manifest", () => {
    const entry = makeEntry();
    writeManifest(outDir, [entry], [{ operatorId: "op", operatorVersion: "1.0.0", materialsSelected: 1, candidatesGenerated: 1, structurallyValid: 1, skipped: [] }]);
    const manifest = readManifest(outDir);
    expect(manifest.entries).toHaveLength(1);
    expect(manifest.entries[0]!.caseId).toBe(entry.caseId);
    expect(manifest.schemaVersion).toBe(1);
  });
});

describe("readManifest schema validation", () => {
  it("rejects an unknown/future schemaVersion", () => {
    writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify({ schemaVersion: 999, entries: [] }));
    expect(() => readManifest(outDir)).toThrow(AcyclicEvalError);
    expect(() => readManifest(outDir)).toThrow(/schemaVersion/);
  });

  it("rejects a manifest missing entries", () => {
    writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify({ schemaVersion: 1 }));
    expect(() => readManifest(outDir)).toThrow(AcyclicEvalError);
  });

  it("rejects a malformed entry (missing required field)", () => {
    const entry = makeEntry() as unknown as Record<string, unknown>;
    delete entry.artifactDigest;
    writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify({ schemaVersion: 1, entries: [entry] }));
    expect(() => readManifest(outDir)).toThrow(/artifactDigest/);
  });

  it("rejects an entry with a malformed expected field (not a recognized ExpectedSpec)", () => {
    const entry = { ...makeEntry(), expected: { kind: "sortof", value: "pass" } };
    writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify({ schemaVersion: 1, entries: [entry] }));
    expect(() => readManifest(outDir)).toThrow(/expected/);
  });

  it("rejects an entry missing the target field", () => {
    const entry = makeEntry() as unknown as Record<string, unknown>;
    delete entry.target;
    writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify({ schemaVersion: 1, entries: [entry] }));
    expect(() => readManifest(outDir)).toThrow(AcyclicEvalError);
    expect(() => readManifest(outDir)).toThrow(/target/);
  });

  it("accepts an entry whose target is JSON null (a legitimate value, distinct from an absent key)", () => {
    const entry = { ...makeEntry(), target: null };
    writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify({ schemaVersion: 1, entries: [entry] }));
    const manifest = readManifest(outDir);
    expect(manifest.entries[0]!.target).toBeNull();
  });

  it("rejects a legacy (pre-acyclic-eval) manifest -- a bare JSON array of evigate-shaped mutant entries", () => {
    const legacyEntries = [
      {
        mutant_id: "M1-session-abc-test_pass",
        source_session: "session-abc",
        mutant_session_id: "mut-m1-session-abc-test_pass",
        operator: "M1",
        claim_kind: "test_pass",
        target_claim_turn: 3,
        target_lines: [10, 11],
        expected_verdict: "contradicted",
        expected_reason_code: "D1",
        mutant_file: "M1/session-abc-test_pass.jsonl",
        notes: "removed the sole successful execution",
      },
    ];
    writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(legacyEntries, null, 2));
    expect(() => readManifest(outDir)).toThrow(AcyclicEvalError);
    expect(() => readManifest(outDir)).toThrow(/legacy/);
  });

  it("rejects a bare JSON array manifest even without evigate-specific field names, still as an incompatible legacy format", () => {
    writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify([{ some: "other-shaped-array-entry" }]));
    expect(() => readManifest(outDir)).toThrow(/bare JSON array/);
  });

  it("rejects an entry whose artifactUri resolves outside outDir (path escape)", () => {
    const entry = { ...makeEntry(), artifactUri: "../../../etc/passwd" };
    writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify({ schemaVersion: 1, entries: [entry] }));
    expect(() => readManifest(outDir)).toThrow(AcyclicEvalError);
    expect(() => readManifest(outDir)).toThrow(/path escape/);
  });

  it("rejects an entry whose artifactUri is an absolute path", () => {
    const entry = { ...makeEntry(), artifactUri: "/etc/passwd" };
    writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify({ schemaVersion: 1, entries: [entry] }));
    expect(() => readManifest(outDir)).toThrow(/path escape/);
  });
});

describe("artifact digest tamper detection", () => {
  it("detects when an artifact file was modified after generation", () => {
    const { artifactUri, artifactDigest } = writeArtifact(outDir, "case-1", { lines: ["a", "b"] });
    const entry = makeEntry({ caseId: "case-1", artifactUri, artifactDigest });

    // Tamper with the artifact after the fact.
    writeFileSync(path.join(outDir, artifactUri), JSON.stringify({ lines: ["a", "b", "TAMPERED"] }, null, 2));

    expect(() => readArtifact(outDir, entry)).toThrow(AcyclicEvalError);
    expect(() => readArtifact(outDir, entry)).toThrow(/tamper detected/);
  });

  it("reads back an untampered artifact successfully", () => {
    const input = { lines: ["a", "b"] };
    const { artifactUri, artifactDigest } = writeArtifact(outDir, "case-2", input);
    const entry = makeEntry({ caseId: "case-2", artifactUri, artifactDigest });
    expect(readArtifact(outDir, entry)).toEqual(input);
  });

  it("original artifact content on disk is plain readable JSON (no opaque encoding)", () => {
    const { artifactUri } = writeArtifact(outDir, "case-3", { lines: ["x"] });
    const raw = readFileSync(path.join(outDir, artifactUri), "utf8");
    expect(JSON.parse(raw)).toEqual({ lines: ["x"] });
  });
});

describe("resolveArtifactPath / readArtifact: path escape defense in depth", () => {
  it("resolveArtifactPath throws for a relative artifactUri that escapes outDir", () => {
    expect(() => resolveArtifactPath(outDir, "../outside.json")).toThrow(AcyclicEvalError);
    expect(() => resolveArtifactPath(outDir, "../outside.json")).toThrow(/path escape/);
  });

  it("resolveArtifactPath throws for an absolute artifactUri", () => {
    expect(() => resolveArtifactPath(outDir, "/etc/passwd")).toThrow(/path escape/);
  });

  it("resolveArtifactPath accepts a normal within-outDir relative path", () => {
    expect(() => resolveArtifactPath(outDir, "artifacts/case-1.json")).not.toThrow();
  });

  it("readArtifact refuses to read an artifact referenced by an escaping artifactUri, even if constructed directly (not via readManifest)", () => {
    const entry = makeEntry({ artifactUri: "../outside.json" });
    expect(() => readArtifact(outDir, entry)).toThrow(/path escape/);
  });
});

describe("artifactRelPath: Windows-compatible filenames", () => {
  it("strips ':' from caseId-derived filenames (caseId always contains ':' by construction, see case-id.ts)", () => {
    const relPath = artifactRelPath("op@1.0.0:abcdef0123456789:0");
    expect(relPath).not.toContain(":");
    expect(relPath).toBe("artifacts/op@1.0.0_abcdef0123456789_0.json");
  });

  it("strips path separators defensively", () => {
    const relPath = artifactRelPath("op/../../etc:passwd");
    expect(relPath).not.toMatch(/[/\\]etc/);
    expect(relPath.startsWith("artifacts/")).toBe(true);
  });
});
