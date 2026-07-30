import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { digestOfValue } from "../src/digest.js";
import { AcyclicEvalError } from "../src/errors.js";
import { evaluate, parseObservationsFile, readObservations } from "../src/evaluate.js";
import { generate } from "../src/generate.js";
import { readArtifact, readManifest } from "../src/manifest.js";
import { expectEquals } from "../src/types.js";
import type { Judge, Material, ManifestEntry, MutationOperator, ValidationResult } from "../src/types.js";

interface Source {
  readonly id: string;
  readonly value: number;
}
interface CaseInput {
  readonly value: number;
}

let outDir: string;

function pass(): ValidationResult {
  return { valid: true };
}

function selectAll(corpus: readonly Source[]): Material<Source>[] {
  return corpus.map((source) => ({ source, anchor: {} }));
}

const passthroughOperator: MutationOperator<Source, CaseInput, number> = {
  id: "passthrough",
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
  selfValidate: pass,
};

function realInputDigest(dir: string, entry: ManifestEntry): string {
  return digestOfValue(readArtifact(dir, entry));
}

beforeEach(async () => {
  outDir = mkdtempSync(path.join(tmpdir(), "acyclic-eval-evaluate-"));
  await generate(
    outDir,
    [passthroughOperator],
    [
      { id: "a", value: 1 },
      { id: "b", value: 2 },
    ],
  );
});

afterEach(() => {
  rmSync(outDir, { recursive: true, force: true });
});

describe("evaluate: no expected-value leakage to the judge", () => {
  it("only ever hands the judge the TCaseInput, never expected/target/operatorId/tags", async () => {
    const receivedInputs: unknown[] = [];
    const judge: Judge<CaseInput, string> = {
      id: "spy",
      evaluate(input) {
        receivedInputs.push(input);
        return "ok";
      },
    };
    await evaluate(outDir, judge);
    expect(receivedInputs).toHaveLength(2);
    for (const input of receivedInputs) {
      expect(Object.keys(input as object).sort()).toEqual(["value"]);
    }
  });
});

describe("evaluate: infra_error accounting", () => {
  it("records a judge exception as an infra_error observation with the error message", async () => {
    const judge: Judge<CaseInput, string> = {
      id: "always-throws",
      evaluate() {
        throw new Error("boom");
      },
    };
    const summary = await evaluate(outDir, judge);
    expect(summary.infraErrorSamples).toBe(2);
    expect(summary.okSamples).toBe(0);
    const { observations } = readObservations(outDir);
    expect(observations).toHaveLength(2);
    for (const obs of observations) {
      expect(obs.status).toBe("infra_error");
      expect(obs.error).toMatch(/boom/);
      expect(obs.attempts).toBe(1); // default retry policy: no retries
    }
  });
});

describe("evaluate: retry and repetition are recorded as separate fields", () => {
  it("records repeated samples (repetition) independently of retry attempts within each sample", async () => {
    // Keyed by (case, sample) -- sampleIndex alone repeats across different cases, so the
    // counter must be scoped per case to avoid conflating repetition with retries.
    const callsPerCaseSample = new Map<string, number>();
    const judge: Judge<CaseInput, string> = {
      id: "flaky-once-per-sample",
      evaluate(input, ctx) {
        const key = `${input.value}-${ctx.sampleIndex}`;
        const calls = (callsPerCaseSample.get(key) ?? 0) + 1;
        callsPerCaseSample.set(key, calls);
        if (calls < 2) throw new Error("transient");
        return `sample-${ctx.sampleIndex}`;
      },
    };

    const summary = await evaluate(outDir, judge, { samples: 3, retry: { maxAttempts: 2 } });
    expect(summary.totalSamples).toBe(2 * 3); // 2 cases x 3 repetitions
    expect(summary.okSamples).toBe(6);

    const { observations } = readObservations(outDir);
    const sampleIndices = new Set(observations.map((o) => o.sampleIndex));
    expect(sampleIndices).toEqual(new Set([0, 1, 2]));
    for (const obs of observations) {
      expect(obs.status).toBe("ok");
      expect(obs.attempts).toBe(2); // every (case, sample) needed exactly one retry
      expect(obs.actual).toBe(`sample-${obs.sampleIndex}`);
    }
  });
});

describe("evaluate: checkpoint / resume", () => {
  it("skips (caseId, sampleIndex) pairs whose recorded inputDigest still matches the current artifact", async () => {
    const manifestEntries = readManifest(outDir).entries;
    const targetEntry = manifestEntries[0]!;
    const preExisting = {
      caseId: targetEntry.caseId,
      sampleIndex: 0,
      attempts: 1,
      // Must match the judge used below for this to count as a genuine skip rather than a
      // judge-identity-mismatch staleness case (see the dedicated test for that below).
      judgeId: "counting",
      inputDigest: realInputDigest(outDir, targetEntry),
      latencyMs: 1,
      timestamp: new Date().toISOString(),
      status: "ok" as const,
      actual: "from-a-previous-run",
    };
    writeFileSync(path.join(outDir, "observations.jsonl"), `${JSON.stringify(preExisting)}\n`);

    const calls: unknown[] = [];
    const judge: Judge<CaseInput, string> = {
      id: "counting",
      evaluate(input) {
        calls.push(input);
        return "fresh";
      },
    };

    const summary = await evaluate(outDir, judge, { resume: true });
    expect(summary.skippedResumedSamples).toBe(1);
    expect(summary.staleObservationsInvalidated).toBe(0);
    expect(summary.ranSamples).toBe(1); // only the second case's sample was missing
    expect(calls).toHaveLength(1);

    const { observations } = readObservations(outDir);
    expect(observations).toHaveLength(2);
    const resumed = observations.find((o) => o.caseId === preExisting.caseId)!;
    expect(resumed.actual).toBe("from-a-previous-run"); // untouched, not re-run
  });

  it("re-runs everything and truncates prior observations when resume is false", async () => {
    let calls = 0;
    const judge: Judge<CaseInput, string> = {
      id: "counting",
      evaluate() {
        calls += 1;
        return "run-again";
      },
    };
    await evaluate(outDir, judge); // first pass, populates observations.jsonl
    expect(calls).toBe(2);

    calls = 0;
    const summary = await evaluate(outDir, judge, { resume: false });
    expect(calls).toBe(2);
    expect(summary.skippedResumedSamples).toBe(0);
    expect(readObservations(outDir).observations).toHaveLength(2);
  });

  it("treats a recorded observation as stale and re-runs it when the case's artifact no longer matches", async () => {
    const manifestEntries = readManifest(outDir).entries;
    const targetEntry = manifestEntries[0]!;
    const preExisting = {
      caseId: targetEntry.caseId,
      sampleIndex: 0,
      attempts: 1,
      judgeId: "previous-run",
      inputDigest: "stale-digest-from-a-different-input",
      latencyMs: 1,
      timestamp: new Date().toISOString(),
      status: "ok" as const,
      actual: "from-a-stale-run",
    };
    writeFileSync(path.join(outDir, "observations.jsonl"), `${JSON.stringify(preExisting)}\n`);

    const calls: unknown[] = [];
    const judge: Judge<CaseInput, string> = {
      id: "counting",
      evaluate(input) {
        calls.push(input);
        return "re-evaluated";
      },
    };

    const summary = await evaluate(outDir, judge, { resume: true });
    expect(summary.staleObservationsInvalidated).toBe(1);
    expect(summary.skippedResumedSamples).toBe(0);
    expect(summary.ranSamples).toBe(2); // the stale one, plus the second case's missing sample
    expect(calls).toHaveLength(2);

    const { observations } = readObservations(outDir);
    // The stale line is superseded by the freshly appended one for the same (caseId, sampleIndex).
    const forTargetCase = observations.find((o) => o.caseId === targetEntry.caseId)!;
    expect(forTargetCase.actual).toBe("re-evaluated");
  });

  it("treats a recorded observation as stale and re-runs it when the judge identity differs, even if the artifact is unchanged", async () => {
    const manifestEntries = readManifest(outDir).entries;
    const targetEntry = manifestEntries[0]!;
    const preExisting = {
      caseId: targetEntry.caseId,
      sampleIndex: 0,
      attempts: 1,
      judgeId: "judge-v1",
      judgeVersion: "1.0.0",
      inputDigest: realInputDigest(outDir, targetEntry), // artifact matches -- only the judge identity differs
      latencyMs: 1,
      timestamp: new Date().toISOString(),
      status: "ok" as const,
      actual: "from-judge-v1",
    };
    writeFileSync(path.join(outDir, "observations.jsonl"), `${JSON.stringify(preExisting)}\n`);

    const calls: unknown[] = [];
    const judgeV2: Judge<CaseInput, string> = {
      id: "judge-v1",
      version: "2.0.0", // same id, different version -- still a different identity
      evaluate(input) {
        calls.push(input);
        return "from-judge-v2";
      },
    };

    const summary = await evaluate(outDir, judgeV2, { resume: true });
    expect(summary.staleObservationsInvalidated).toBe(1);
    expect(summary.skippedResumedSamples).toBe(0);
    expect(summary.ranSamples).toBe(2); // the judge-identity-stale one, plus the second case's missing sample
    expect(calls).toHaveLength(2);

    const { observations } = readObservations(outDir);
    const forTargetCase = observations.find((o) => o.caseId === targetEntry.caseId)!;
    expect(forTargetCase.actual).toBe("from-judge-v2");
    expect(forTargetCase.judgeVersion).toBe("2.0.0");
  });
});

describe("evaluate/score: tolerant JSONL parsing", () => {
  it("parseObservationsFile drops a torn trailing line (no closing newline) without error", () => {
    const good = JSON.stringify({
      caseId: "c1",
      sampleIndex: 0,
      attempts: 1,
      judgeId: "j",
      inputDigest: "d",
      latencyMs: 1,
      timestamp: "t",
      status: "ok",
      actual: "x",
    });
    const torn = `${good}\n{"caseId":"c2","sampleIndex":0,"attempts":1,"judgeId":"j","incomplete`; // no trailing newline
    const result = parseObservationsFile(torn, "test");
    expect(result.tornTailDropped).toBe(true);
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0]!.caseId).toBe("c1");
  });

  it("parseObservationsFile throws on a malformed line that is not a torn tail (mid-file corruption)", () => {
    const good = JSON.stringify({
      caseId: "c1",
      sampleIndex: 0,
      attempts: 1,
      judgeId: "j",
      inputDigest: "d",
      latencyMs: 1,
      timestamp: "t",
      status: "ok",
      actual: "x",
    });
    const corruptedThenGood = `not valid json at all\n${good}\n`; // corrupted line is NOT last
    expect(() => parseObservationsFile(corruptedThenGood, "test")).toThrow(AcyclicEvalError);
    expect(() => parseObservationsFile(corruptedThenGood, "test")).toThrow(/malformed observation/);
  });

  it("parseObservationsFile throws on a malformed last line that DOES have a trailing newline (not a torn write)", () => {
    const corruptedButTerminated = "this is not json\n";
    expect(() => parseObservationsFile(corruptedButTerminated, "test")).toThrow(/malformed observation/);
  });

  it("evaluate() resume tolerates and repairs a torn trailing observation, re-running that sample", async () => {
    const manifestEntries = readManifest(outDir).entries;
    const [entryA, entryB] = manifestEntries;
    const goodObs = JSON.stringify({
      caseId: entryA!.caseId,
      sampleIndex: 0,
      attempts: 1,
      judgeId: "counting", // must match the judge used below to be a genuine skip, not judge-identity staleness
      inputDigest: realInputDigest(outDir, entryA!),
      latencyMs: 1,
      timestamp: new Date().toISOString(),
      status: "ok",
      actual: "kept-from-before",
    });
    // Simulate a process killed mid-append while writing case B's observation: a syntactically
    // incomplete line with no trailing newline.
    const tornLine = `{"caseId":"${entryB!.caseId}","sampleIndex":0,"attempts":1,"judgeId":"pr`;
    writeFileSync(path.join(outDir, "observations.jsonl"), `${goodObs}\n${tornLine}`);

    const calls: string[] = [];
    const judge: Judge<CaseInput, string> = {
      id: "counting",
      evaluate(input) {
        calls.push(JSON.stringify(input));
        return "recovered";
      },
    };

    const summary = await evaluate(outDir, judge, { resume: true });
    expect(summary.skippedResumedSamples).toBe(1); // entryA's complete observation
    expect(summary.ranSamples).toBe(1); // entryB's torn observation is treated as never-recorded
    expect(calls).toHaveLength(1);

    const { observations } = readObservations(outDir);
    expect(observations).toHaveLength(2);
    expect(observations.find((o) => o.caseId === entryA!.caseId)!.actual).toBe("kept-from-before");
    expect(observations.find((o) => o.caseId === entryB!.caseId)!.actual).toBe("recovered");
  });

  it("evaluate() resume throws on non-tail corruption instead of silently mis-resuming", async () => {
    writeFileSync(path.join(outDir, "observations.jsonl"), "corrupted garbage, not json\nmore garbage\n");
    const judge: Judge<CaseInput, string> = { id: "unused", evaluate: () => "n/a" };
    await expect(evaluate(outDir, judge, { resume: true })).rejects.toThrow(AcyclicEvalError);
  });
});

describe("evaluate: empty manifest", () => {
  it("handles a manifest with zero entries without error", async () => {
    const emptyOutDir = mkdtempSync(path.join(tmpdir(), "acyclic-eval-evaluate-empty-"));
    try {
      await generate(emptyOutDir, [passthroughOperator], []);
      const judge: Judge<CaseInput, string> = { id: "unused", evaluate: () => "n/a" };
      const summary = await evaluate(emptyOutDir, judge);
      expect(summary.totalCases).toBe(0);
      expect(summary.totalSamples).toBe(0);
    } finally {
      rmSync(emptyOutDir, { recursive: true, force: true });
    }
  });
});

describe("evaluate: append-based checkpointing", () => {
  it("appends observations one at a time so a killed process keeps partial progress", async () => {
    const judge: Judge<CaseInput, string> = { id: "slow", evaluate: () => "ok" };
    await evaluate(outDir, judge, { concurrency: 1 });
    // Simulate a manual append (as a crashed-and-resumed process would leave behind).
    appendFileSync(path.join(outDir, "observations.jsonl"), "");
    expect(readObservations(outDir).observations).toHaveLength(2);
  });
});
