// evaluate: manifest -> observations (raw judge output). Deliberately does
// not score anything -- that's score()'s job, so a report can be redone with
// a different Comparator without re-running (possibly expensive/costly) LLM
// calls. Observations are appended to observations.jsonl as they complete,
// which is what makes checkpoint/resume possible: a second run with
// `resume: true` (the default) skips (caseId, sampleIndex) pairs that already
// have a recorded observation -- *unless* the case's artifact now hashes
// differently than what that observation was recorded against, in which case
// it's treated as stale and re-run (see `staleObservationsInvalidated`).
//
// The object handed to `judge.evaluate()` is exactly the TCaseInput read
// back from the artifact file -- never the manifest entry, so a Judge can
// never see `expected`, `target`, `operatorId`, or `tags`.

import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { digestOfValue } from "./digest.js";
import { AcyclicEvalError } from "./errors.js";
import { readArtifact, readManifest } from "./manifest.js";
import { runPool, runWithRetryAndTimeout } from "./runner.js";
import type { EvaluateSummary, Judge, ManifestEntry, Observation, RunnerOptions } from "./types.js";

export const OBSERVATIONS_FILE = "observations.jsonl";

function observationKey(caseId: string, sampleIndex: number): string {
  return `${caseId} ${sampleIndex}`;
}

export interface ParsedObservationsFile {
  /**
   * Observations in file order, one Map entry surviving per (caseId,
   * sampleIndex) key -- if the same key appears more than once (e.g. a
   * stale observation was invalidated and re-run in a later evaluate()
   * call, appending a second line for the same key), the *last* occurrence
   * in the file wins. This mirrors how a second evaluate() run supersedes
   * an earlier one: appended, never edited in place.
   */
  readonly observations: readonly Observation[];
  /**
   * True if the file's last line could not be parsed AND the file did not
   * end with a trailing newline -- the signature of a process being killed
   * mid-`appendFileSync`. That single line is dropped rather than treated
   * as an error: the (caseId, sampleIndex) it would have recorded is simply
   * treated as not-yet-evaluated.
   */
  readonly tornTailDropped: boolean;
}

/**
 * Parses an observations.jsonl file, tolerating exactly one specific kind of
 * damage: an incomplete trailing write (no closing newline) from a process
 * killed mid-append. Any other malformed line -- including a malformed line
 * that merely *happens* to be last but the file *does* end with a newline,
 * or any malformed line before the last one -- is reported as a hard error
 * rather than silently dropped, since that pattern doesn't match ordinary
 * crash recovery and something else is wrong.
 */
export function parseObservationsFile(content: string, sourceLabel: string): ParsedObservationsFile {
  if (content === "") return { observations: [], tornTailDropped: false };

  const endsWithNewline = content.endsWith("\n");
  const rawLines = content.split("\n").filter((line) => line.trim() !== "");
  const byKey = new Map<string, Observation>();
  let tornTailDropped = false;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]!;
    const isLastLine = i === rawLines.length - 1;
    let obs: Observation;
    try {
      obs = JSON.parse(line) as Observation;
    } catch (err) {
      if (isLastLine && !endsWithNewline) {
        tornTailDropped = true;
        break;
      }
      throw new AcyclicEvalError(
        `${sourceLabel}: malformed observation on line ${i + 1} of ${rawLines.length}. This is not the torn ` +
          `tail of an interrupted append (the file has a complete trailing newline, or the malformed line ` +
          `isn't the last one), so it is being reported instead of silently dropped: ${(err as Error).message}`,
      );
    }
    byKey.set(observationKey(obs.caseId, obs.sampleIndex), obs);
  }

  return { observations: [...byKey.values()], tornTailDropped };
}

function readObservationsFile(obsPath: string, sourceLabel: string): ParsedObservationsFile {
  if (!existsSync(obsPath)) return { observations: [], tornTailDropped: false };
  return parseObservationsFile(readFileSync(obsPath, "utf8"), sourceLabel);
}

interface WorkItem {
  readonly entry: ManifestEntry;
  readonly sampleIndex: number;
}

export async function evaluate<TCaseInput, TActual>(
  outDir: string,
  judge: Judge<TCaseInput, TActual>,
  options: RunnerOptions = {},
): Promise<EvaluateSummary> {
  const manifest = readManifest(outDir);
  const samples = options.samples ?? 1;
  const concurrency = options.concurrency ?? 1;
  const maxAttempts = options.retry?.maxAttempts ?? 1;
  const backoffMs = options.retry?.backoffMs ?? 0;
  const resume = options.resume ?? true;

  const obsPath = path.join(outDir, OBSERVATIONS_FILE);

  let recordedByKey = new Map<string, Observation>();
  if (!resume) {
    writeFileSync(obsPath, "");
  } else {
    const parsed = readObservationsFile(obsPath, `resuming from ${obsPath}`);
    recordedByKey = new Map(parsed.observations.map((obs) => [observationKey(obs.caseId, obs.sampleIndex), obs]));
    if (parsed.tornTailDropped) {
      // Repair the file on disk: leaving the torn fragment in place would corrupt the
      // next appended line too (no newline separator would exist between them).
      const repaired = parsed.observations.map((obs) => JSON.stringify(obs)).join("\n");
      writeFileSync(obsPath, parsed.observations.length > 0 ? `${repaired}\n` : "");
    } else if (!existsSync(obsPath)) {
      writeFileSync(obsPath, "");
    }
  }

  // Reading (and digesting) an artifact is the same regardless of how many
  // samples/repetitions a case has, so cache it per caseId rather than
  // re-reading per (caseId, sampleIndex) work item.
  const artifactCache = new Map<string, { readonly input: TCaseInput; readonly digest: string }>();
  function getArtifact(entry: ManifestEntry): { readonly input: TCaseInput; readonly digest: string } {
    let cached = artifactCache.get(entry.caseId);
    if (!cached) {
      const input = readArtifact<TCaseInput>(outDir, entry);
      cached = { input, digest: digestOfValue(input) };
      artifactCache.set(entry.caseId, cached);
    }
    return cached;
  }

  const workItems: WorkItem[] = [];
  for (const entry of manifest.entries) {
    for (let sampleIndex = 0; sampleIndex < samples; sampleIndex++) {
      workItems.push({ entry, sampleIndex });
    }
  }

  const pending: WorkItem[] = [];
  let skippedResumedSamples = 0;
  let staleObservationsInvalidated = 0;
  for (const item of workItems) {
    const recorded = recordedByKey.get(observationKey(item.entry.caseId, item.sampleIndex));
    if (recorded === undefined) {
      pending.push(item);
      continue;
    }
    const current = getArtifact(item.entry);
    const artifactMatches = recorded.inputDigest === current.digest;
    // A recorded observation from a different judge identity says nothing about what THIS
    // judge would produce for this case -- treat it exactly like an artifact mismatch: stale,
    // not reusable.
    const judgeMatches = recorded.judgeId === judge.id && recorded.judgeVersion === judge.version;
    if (artifactMatches && judgeMatches) {
      skippedResumedSamples += 1;
    } else {
      staleObservationsInvalidated += 1;
      pending.push(item);
    }
  }

  let okSamples = 0;
  let infraErrorSamples = 0;

  await runPool(pending, concurrency, async (item) => {
    const { input, digest: inputDigest } = getArtifact(item.entry);
    const outcome = await runWithRetryAndTimeout(
      (ctx) => judge.evaluate(input, { signal: ctx.signal, sampleIndex: item.sampleIndex }),
      { maxAttempts, backoffMs, timeoutMs: options.timeoutMs },
    );

    const base = {
      caseId: item.entry.caseId,
      sampleIndex: item.sampleIndex,
      attempts: outcome.attempts,
      judgeId: judge.id,
      judgeVersion: judge.version,
      inputDigest,
      latencyMs: outcome.latencyMs,
      timestamp: new Date().toISOString(),
    };
    const observation: Observation = outcome.ok
      ? { ...base, status: "ok", actual: outcome.value }
      : { ...base, status: "infra_error", error: outcome.error };

    appendFileSync(obsPath, `${JSON.stringify(observation)}\n`);
    if (observation.status === "ok") okSamples += 1;
    else infraErrorSamples += 1;
  });

  return {
    totalCases: manifest.entries.length,
    totalSamples: workItems.length,
    ranSamples: pending.length,
    skippedResumedSamples,
    staleObservationsInvalidated,
    okSamples,
    infraErrorSamples,
  };
}

/**
 * Reads observations.jsonl, deduped so only the latest observation per
 * (caseId, sampleIndex) survives (see `ParsedObservationsFile`). A torn
 * trailing write is dropped and reported via `tornTailDropped` rather than
 * thrown; any other malformed line throws `AcyclicEvalError`.
 */
export function readObservations(outDir: string): ParsedObservationsFile {
  return readObservationsFile(path.join(outDir, OBSERVATIONS_FILE), `scoring ${outDir}`);
}
