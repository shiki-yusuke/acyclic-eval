#!/usr/bin/env node
// Thin CLI wrapper around the library API. All the actual pipeline pieces
// (corpus, operators, judge, comparator, optional metricAdapter) live in a
// user-supplied config module -- the CLI only wires generate/evaluate/score
// together and forwards runner options as flags. `generate` and `evaluate`
// are separate subcommands on purpose: running them as separate processes
// (e.g. `acyclic-eval generate` in one CI step, `acyclic-eval evaluate` in
// another that only has judge credentials) keeps the mutant-generation code
// path from ever sharing an in-memory state with the judge call path.

import path from "node:path";
import { AcyclicEvalError } from "./errors.js";
import { evaluate } from "./evaluate.js";
import { generate } from "./generate.js";
import { formatReport } from "./report.js";
import { score } from "./score.js";
import type { Comparator, Judge, MetricAdapter, MutationOperator } from "./types.js";

// The CLI loads these pieces dynamically from a user config module, so their
// type parameters can't be known statically here -- `any` is intentional.
interface PipelineConfig {
  readonly corpus: readonly unknown[];
  readonly operators: ReadonlyArray<MutationOperator<any, any, any>>;
  readonly judge: Judge<any, any>;
  readonly comparator: Comparator<any, any>;
  readonly metricAdapter?: MetricAdapter<any, any>;
}

function parseFlags(argv: readonly string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) continue;
    const body = arg.slice(2);
    const eq = body.indexOf("=");
    if (eq !== -1) {
      flags[body.slice(0, eq)] = body.slice(eq + 1);
      continue;
    }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags[body] = next;
      i += 1;
    } else {
      flags[body] = "true";
    }
  }
  return flags;
}

async function loadConfig(configPath: string): Promise<PipelineConfig> {
  const resolved = path.resolve(configPath);
  const mod = (await import(resolved)) as { default?: Partial<PipelineConfig> } & Partial<PipelineConfig>;
  const config = mod.default ?? mod;
  if (!config.corpus || !config.operators || !config.judge || !config.comparator) {
    throw new AcyclicEvalError(
      `config module "${configPath}" must export { corpus, operators, judge, comparator } (metricAdapter is optional)`,
    );
  }
  return config as PipelineConfig;
}

function printUsage(): void {
  console.log(
    [
      "acyclic-eval <generate|evaluate|score> --config <path> [--out <dir>] [options]",
      "",
      "  generate  --config <path> --out <dir>",
      "  evaluate  --config <path> --out <dir> [--samples N] [--concurrency N] [--timeout ms] [--retry N] [--no-resume]",
      "  score     --config <path> --out <dir> [--min-coverage 0..1] [--min-pass-rate 0..1]",
    ].join("\n"),
  );
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  const outDir = flags.out ?? ".acyclic-eval-out";

  if (command === undefined || flags.config === undefined) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const config = await loadConfig(flags.config);

  switch (command) {
    case "generate": {
      const result = generate(outDir, config.operators, config.corpus);
      console.log(`generated ${result.manifest.entries.length} case(s) into ${outDir}`);
      break;
    }
    case "evaluate": {
      const summary = await evaluate(outDir, config.judge, {
        samples: flags.samples ? Number(flags.samples) : undefined,
        concurrency: flags.concurrency ? Number(flags.concurrency) : undefined,
        timeoutMs: flags.timeout ? Number(flags.timeout) : undefined,
        retry: flags.retry ? { maxAttempts: Number(flags.retry) } : undefined,
        resume: flags["no-resume"] === "true" ? false : true,
      });
      console.log(JSON.stringify(summary, null, 2));
      break;
    }
    case "score": {
      const report = score(outDir, config.comparator, {
        metricAdapter: config.metricAdapter,
        minCoverage: flags["min-coverage"] ? Number(flags["min-coverage"]) : undefined,
        minPassRate: flags["min-pass-rate"] ? Number(flags["min-pass-rate"]) : undefined,
      });
      console.log(formatReport(report).markdown);
      if (!report.pass) process.exitCode = 1;
      break;
    }
    default:
      printUsage();
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
