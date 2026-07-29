import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { evaluate } from "../src/evaluate.js";
import { generate } from "../src/generate.js";
import { score } from "../src/score.js";
import { toyComparator } from "../examples/toy/comparator.js";
import { toyCorpus } from "../examples/toy/corpus.js";
import { toyJudge } from "../examples/toy/judge.js";
import { toyOperators } from "../examples/toy/operators.js";

let outDir: string;

beforeEach(() => {
  outDir = mkdtempSync(path.join(tmpdir(), "acyclic-eval-toy-e2e-"));
});

afterEach(() => {
  rmSync(outDir, { recursive: true, force: true });
});

describe("toy example: generate -> evaluate -> score", () => {
  it("runs end to end and the correct judge passes every generated case", async () => {
    const generated = generate(outDir, toyOperators, toyCorpus);
    // 3 operators x 3 runs with a passing last "$ npm test" block (run-4 has no test command at all)
    expect(generated.manifest.entries).toHaveLength(9);

    const summary = await evaluate(outDir, toyJudge);
    expect(summary.infraErrorSamples).toBe(0);
    expect(summary.okSamples).toBe(9);

    const report = score(outDir, toyComparator, { minCoverage: 1 });
    expect(report.overall.evaluated).toBe(9);
    expect(report.overall.passed).toBe(9);
    expect(report.mismatches).toHaveLength(0);
    expect(report.coverageWarnings).toHaveLength(0);
    expect(report.pass).toBe(true);
  });

  it("a judge with the M5-style bug (also consults an earlier unrelated block) fails the precision-side operator", async () => {
    generate(outDir, toyOperators, toyCorpus);
    // A deliberately buggy judge: reports "fail" if *any* block in the transcript failed,
    // ignoring recency. This should be caught by toy-inject-earlier-failure (precision side).
    const buggyJudge = {
      id: "buggy-any-block-judge",
      evaluate(input: { lines: readonly string[] }) {
        if (input.lines.some((l) => l.startsWith("FAIL"))) return "fail" as const;
        if (input.lines.some((l) => l.startsWith("PASS"))) return "pass" as const;
        return "unknown" as const;
      },
    };
    await evaluate(outDir, buggyJudge);
    const report = score(outDir, toyComparator);
    const precisionMismatches = report.mismatches.filter((m) => m.operatorId === "toy-inject-earlier-failure");
    expect(precisionMismatches.length).toBeGreaterThan(0);
  });
});
