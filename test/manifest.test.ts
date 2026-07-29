import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AcyclicEvalError } from "../src/errors.js";
import { readArtifact, readManifest, writeArtifact, writeManifest } from "../src/manifest.js";
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
