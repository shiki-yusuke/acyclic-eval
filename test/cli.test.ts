// Verifies the CLI's config-loading contract: `generate` must never import
// (even transitively) whatever a config module's evaluateConfig() would use
// to build a Judge. A static top-level `import` in the config module would
// defeat this regardless of which named export the CLI reads afterward, so
// the fixture config module below only imports the judge module from
// *inside* evaluateConfig() -- exactly the pattern examples/toy/config.ts
// uses.

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadEvaluateConfig, loadGenerateConfig, loadScoreConfig } from "../src/cli.js";
import { AcyclicEvalError } from "../src/errors.js";

declare global {
  // eslint-disable-next-line no-var
  var __acyclicEvalTestJudgeLoadCount: number | undefined;
}

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "acyclic-eval-cli-"));
  delete globalThis.__acyclicEvalTestJudgeLoadCount;

  writeFileSync(
    path.join(dir, "judge-marker.mjs"),
    [
      "// Import side-effect marker: incremented once per module evaluation.",
      "globalThis.__acyclicEvalTestJudgeLoadCount = (globalThis.__acyclicEvalTestJudgeLoadCount ?? 0) + 1;",
      'export const judge = { id: "marker-judge", evaluate: () => "x" };',
    ].join("\n"),
  );

  writeFileSync(
    path.join(dir, "config.mjs"),
    [
      "export async function generateConfig() {",
      "  return { corpus: [1, 2, 3], operators: [] };",
      "}",
      "export async function evaluateConfig() {",
      '  const { judge } = await import("./judge-marker.mjs");',
      "  return { judge };",
      "}",
      "export async function scoreConfig() {",
      '  return { comparator: { id: "c", version: "1", compare: () => ({ pass: true }) } };',
      "}",
    ].join("\n"),
  );
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete globalThis.__acyclicEvalTestJudgeLoadCount;
});

describe("CLI config loading keeps generate from ever importing the judge module", () => {
  it("loadGenerateConfig resolves corpus/operators without triggering the judge module's import side effect", async () => {
    const config = await loadGenerateConfig(path.join(dir, "config.mjs"));
    expect(config.corpus).toEqual([1, 2, 3]);
    expect(config.operators).toEqual([]);
    expect(globalThis.__acyclicEvalTestJudgeLoadCount).toBeUndefined();
  });

  it("loadEvaluateConfig does trigger the judge module's import (sanity check the marker itself works)", async () => {
    const config = await loadEvaluateConfig(path.join(dir, "config.mjs"));
    expect(config.judge.id).toBe("marker-judge");
    expect(globalThis.__acyclicEvalTestJudgeLoadCount).toBe(1);
  });

  it("loadScoreConfig resolves the comparator without touching the judge module", async () => {
    const config = await loadScoreConfig(path.join(dir, "config.mjs"));
    expect(config.comparator.id).toBe("c");
    expect(globalThis.__acyclicEvalTestJudgeLoadCount).toBeUndefined();
  });
});

describe("CLI config loading: clear errors for a malformed config module", () => {
  it("rejects a config module missing generateConfig()", async () => {
    writeFileSync(path.join(dir, "empty.mjs"), "export const nothing = true;\n");
    await expect(loadGenerateConfig(path.join(dir, "empty.mjs"))).rejects.toThrow(AcyclicEvalError);
    await expect(loadGenerateConfig(path.join(dir, "empty.mjs"))).rejects.toThrow(/generateConfig/);
  });

  it("rejects a generateConfig() that doesn't return corpus/operators", async () => {
    writeFileSync(path.join(dir, "bad.mjs"), "export async function generateConfig() { return {}; }\n");
    await expect(loadGenerateConfig(path.join(dir, "bad.mjs"))).rejects.toThrow(/corpus, operators/);
  });

  it("rejects an evaluateConfig() that doesn't return a judge", async () => {
    writeFileSync(path.join(dir, "bad2.mjs"), "export async function evaluateConfig() { return {}; }\n");
    await expect(loadEvaluateConfig(path.join(dir, "bad2.mjs"))).rejects.toThrow(/judge/);
  });

  it("rejects a scoreConfig() that doesn't return a comparator", async () => {
    writeFileSync(path.join(dir, "bad3.mjs"), "export async function scoreConfig() { return {}; }\n");
    await expect(loadScoreConfig(path.join(dir, "bad3.mjs"))).rejects.toThrow(/comparator/);
  });
});
