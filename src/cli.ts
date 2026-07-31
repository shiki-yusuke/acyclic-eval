#!/usr/bin/env node
// Thin CLI wrapper around the library API. `generate`, `evaluate`, and
// `score` each load only their own piece of the pipeline from the config
// module at `--config` (generateConfig / evaluateConfig / scoreConfig,
// respectively) -- NOT one shared object with all of corpus/operators/judge/
// comparator eagerly resolved. This matters: if the config module ever did
// `import { judge } from "./judge.js"` at its top level, that import would
// execute as soon as ANY subcommand loaded the module, including `generate`
// -- silently defeating the whole point of running generate/evaluate as
// separate processes (see docs/threat-model.md's "process/entry-point
// separation"). Requiring the config module to expose small per-subcommand
// functions (which can each do their own dynamic `import()` internally, as
// examples/toy/config.ts does) means `generate` never touches whatever
// `evaluateConfig()` would have imported to build a Judge.

import path from "node:path";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AcyclicEvalError } from "./errors.js";
import { evaluate } from "./evaluate.js";
import { generate } from "./generate.js";
import { formatReport } from "./report.js";
import { score } from "./score.js";
import type { EvaluateConfig, GenerateConfig, ScoreConfig } from "./types.js";

// The CLI loads these dynamically from a user config module, so their type
// parameters can't be known statically here -- `any` is intentional.
type AnyGenerateConfig = GenerateConfig<any, any, any>;
type AnyEvaluateConfig = EvaluateConfig<any, any>;
type AnyScoreConfig = ScoreConfig<any, any>;

async function importConfigModule(configPath: string): Promise<Record<string, unknown>> {
  const resolved = path.resolve(configPath);
  return (await import(resolved)) as Record<string, unknown>;
}

export async function loadGenerateConfig(configPath: string): Promise<AnyGenerateConfig> {
  const mod = await importConfigModule(configPath);
  if (typeof mod.generateConfig !== "function") {
    throw new AcyclicEvalError(
      `config module "${configPath}" must export an async or sync function generateConfig() ` +
        `returning { corpus, operators } (it must not need a judge or comparator to run).`,
    );
  }
  const config = (await (mod.generateConfig as () => unknown)()) as Partial<AnyGenerateConfig>;
  if (!config.corpus || !config.operators) {
    throw new AcyclicEvalError(`generateConfig() in "${configPath}" must return { corpus, operators }`);
  }
  return config as AnyGenerateConfig;
}

export async function loadEvaluateConfig(configPath: string): Promise<AnyEvaluateConfig> {
  const mod = await importConfigModule(configPath);
  if (typeof mod.evaluateConfig !== "function") {
    throw new AcyclicEvalError(
      `config module "${configPath}" must export an async or sync function evaluateConfig() returning { judge }.`,
    );
  }
  const config = (await (mod.evaluateConfig as () => unknown)()) as Partial<AnyEvaluateConfig>;
  if (!config.judge) {
    throw new AcyclicEvalError(`evaluateConfig() in "${configPath}" must return { judge }`);
  }
  return config as AnyEvaluateConfig;
}

export async function loadScoreConfig(configPath: string): Promise<AnyScoreConfig> {
  const mod = await importConfigModule(configPath);
  if (typeof mod.scoreConfig !== "function") {
    throw new AcyclicEvalError(
      `config module "${configPath}" must export an async or sync function scoreConfig() ` +
        `returning { comparator, metricAdapter? }.`,
    );
  }
  const config = (await (mod.scoreConfig as () => unknown)()) as Partial<AnyScoreConfig>;
  if (!config.comparator) {
    throw new AcyclicEvalError(`scoreConfig() in "${configPath}" must return { comparator }`);
  }
  return config as AnyScoreConfig;
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

function printUsage(): void {
  console.log(
    [
      "acyclic-eval <generate|evaluate|score> --config <path> [--out <dir>] [options]",
      "",
      "  generate  --config <path> --out <dir>",
      "  evaluate  --config <path> --out <dir> [--samples N] [--concurrency N] [--timeout ms] [--retry N] [--no-resume]",
      "  score     --config <path> --out <dir> [--min-coverage 0..1] [--min-pass-rate 0..1]",
      "                                        [--allow-zero-generated op1,op2,...]",
      "",
      "The config module at --config must export generateConfig()/evaluateConfig()/scoreConfig()",
      "as needed by the subcommand(s) you run -- see examples/toy/config.ts.",
    ].join("\n"),
  );
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  const outDir = flags.out ?? ".acyclic-eval-out";

  if (command === "--help" || command === "-h" || flags.help === "true") {
    printUsage();
    return;
  }

  if (command === undefined || flags.config === undefined) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  switch (command) {
    case "generate": {
      const config = await loadGenerateConfig(flags.config);
      const result = await generate(outDir, config.operators, config.corpus);
      console.log(`generated ${result.manifest.entries.length} case(s) into ${outDir}`);
      break;
    }
    case "evaluate": {
      const config = await loadEvaluateConfig(flags.config);
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
      const config = await loadScoreConfig(flags.config);
      const report = score(outDir, config.comparator, {
        metricAdapter: config.metricAdapter,
        minCoverage: flags["min-coverage"] ? Number(flags["min-coverage"]) : undefined,
        minPassRate: flags["min-pass-rate"] ? Number(flags["min-pass-rate"]) : undefined,
        allowZeroGenerated:
          flags["allow-zero-generated"] !== undefined
            ? flags["allow-zero-generated"]
                .split(",")
                .map((s) => s.trim())
                .filter((s) => s !== "")
            : undefined,
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

// Only run as a CLI entry point, not when imported by tests for loadGenerateConfig etc.
// npm creates node_modules/.bin/acyclic-eval as a symlink. Resolve both paths
// before comparing so the installed package's bin actually executes, while an
// import from tests or a library consumer remains side-effect free.
const isMain =
  process.argv[1] !== undefined &&
  realpathSync(path.resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
