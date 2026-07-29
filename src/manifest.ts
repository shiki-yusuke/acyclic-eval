import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CURRENT_SCHEMA_VERSION, type ExpectedSpec, type GenerationOperatorStats, type Manifest, type ManifestEntry } from "./types.js";
import { sha256Hex } from "./digest.js";
import { AcyclicEvalError } from "./errors.js";

const MANIFEST_FILE = "manifest.json";
const ARTIFACT_DIR = "artifacts";

export function artifactRelPath(caseId: string): string {
  // caseId already excludes path separators (operatorId/version are expected to be simple
  // identifiers), but sanitize defensively so a malicious/odd operator id can't escape outDir.
  const safe = caseId.replace(/[/\\]/g, "_");
  return path.posix.join(ARTIFACT_DIR, `${safe}.json`);
}

export function writeArtifact(outDir: string, caseId: string, input: unknown): { artifactUri: string; artifactDigest: string } {
  const relPath = artifactRelPath(caseId);
  const fullPath = path.join(outDir, relPath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  const content = JSON.stringify(input, null, 2);
  writeFileSync(fullPath, content);
  return { artifactUri: relPath, artifactDigest: sha256Hex(content) };
}

export function readArtifact<TCaseInput>(outDir: string, entry: ManifestEntry): TCaseInput {
  const fullPath = path.join(outDir, entry.artifactUri);
  const content = readFileSync(fullPath, "utf8");
  const digest = sha256Hex(content);
  if (digest !== entry.artifactDigest) {
    throw new AcyclicEvalError(
      `tamper detected: artifact for case ${entry.caseId} does not match its recorded digest ` +
        `(expected ${entry.artifactDigest}, got ${digest}). Refusing to evaluate a possibly-modified case.`,
    );
  }
  return JSON.parse(content) as TCaseInput;
}

export function writeManifest(outDir: string, entries: ManifestEntry[], operatorStats: GenerationOperatorStats[]): Manifest {
  const manifest: Manifest = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    entries,
    operatorStats,
  };
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, MANIFEST_FILE), JSON.stringify(manifest, null, 2));
  return manifest;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isExpectedSpec(v: unknown): v is ExpectedSpec<unknown> {
  if (!isRecord(v)) return false;
  if (v.kind === "equals") return "value" in v;
  if (v.kind === "oneOf") return Array.isArray(v.values);
  if (v.kind === "forbid") return Array.isArray(v.values);
  return false;
}

function assertManifestEntry(v: unknown, index: number): ManifestEntry {
  if (!isRecord(v)) throw new AcyclicEvalError(`manifest entry #${index} is not an object`);
  const required: Array<keyof ManifestEntry> = [
    "schemaVersion",
    "caseId",
    "operatorId",
    "operatorVersion",
    "artifactUri",
    "artifactDigest",
    "sourceDigest",
    "expected",
    "tags",
  ];
  for (const key of required) {
    if (!(key in v)) throw new AcyclicEvalError(`manifest entry #${index} is missing required field "${key}"`);
  }
  if (!isExpectedSpec(v.expected)) {
    throw new AcyclicEvalError(`manifest entry #${index} has a malformed "expected" field`);
  }
  if (!Array.isArray(v.tags)) {
    throw new AcyclicEvalError(`manifest entry #${index} has a non-array "tags" field`);
  }
  return v as unknown as ManifestEntry;
}

/**
 * Loads and validates a manifest. Rejects unknown schema versions explicitly
 * rather than guessing at forward/backward compatibility.
 */
export function readManifest(outDir: string): Manifest {
  const fullPath = path.join(outDir, MANIFEST_FILE);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(fullPath, "utf8"));
  } catch (err) {
    throw new AcyclicEvalError(`failed to read/parse manifest at ${fullPath}: ${(err as Error).message}`);
  }
  if (!isRecord(raw)) throw new AcyclicEvalError(`manifest at ${fullPath} is not a JSON object`);
  if (raw.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new AcyclicEvalError(
      `unsupported manifest schemaVersion ${JSON.stringify(raw.schemaVersion)} at ${fullPath} ` +
        `(this build of acyclic-eval only supports schemaVersion ${CURRENT_SCHEMA_VERSION}). ` +
        `Regenerate the manifest with a matching version.`,
    );
  }
  if (!Array.isArray(raw.entries)) throw new AcyclicEvalError(`manifest at ${fullPath} has a non-array "entries" field`);
  const entries = raw.entries.map((e, i) => assertManifestEntry(e, i));
  const operatorStats = Array.isArray(raw.operatorStats) ? (raw.operatorStats as GenerationOperatorStats[]) : [];
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    generatedAt: typeof raw.generatedAt === "string" ? raw.generatedAt : new Date(0).toISOString(),
    entries,
    operatorStats,
  };
}
