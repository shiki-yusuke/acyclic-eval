import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = mkdtempSync(path.join(tmpdir(), "acyclic-eval-package-"));
const cache = path.join(sandbox, "npm-cache");
const packDirectory = path.join(sandbox, "pack");
// A native ESM import must treat the consumer directory as a filesystem path.
const consumer = path.join(sandbox, "workspace #1 100%", "consumer");
const output = path.join(consumer, "out");
const env = { ...process.env, npm_config_cache: cache, npm_config_audit: "false", npm_config_fund: "false" };

function run(command, args, cwd = root) {
  return execFileSync(command, args, { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

try {
  mkdirSync(packDirectory);
  mkdirSync(consumer, { recursive: true });
  const packed = JSON.parse(run("npm", ["pack", "--json", "--pack-destination", packDirectory]));
  const packageInfo = packed[0];
  if (!packageInfo?.filename || !Array.isArray(packageInfo.files)) {
    throw new Error("npm pack did not return file metadata.");
  }

  const packagedFiles = packageInfo.files.map((file) => file.path);
  // npm pack --json reports paths relative to the package root (without the
  // `package/` prefix that `tar -tf` would display).
  const required = [
    "dist/src/cli.js",
    "dist/src/index.js",
    "dist/src/index.d.ts",
    "dist/examples/toy/config.js",
    "dist/examples/rule-based-judge/config.js",
    "dist/examples/llm-judge-adapter/adapter.js",
  ];
  // Review this check alongside the files list whenever an example is published.
  const publishedModule = /^dist\/(?:src|examples\/(?:toy|rule-based-judge|llm-judge-adapter))\/.+\.(?:js|d\.ts)$/;
  const prohibited = [
    /(^|\/)\.env(?:\.|$)/,
    /^(?:test|docs|coverage)\//,
    /\.map$/,
    /(?:^|\/)(?:transcript|observations|manifest)\.jsonl?$/i,
  ];
  for (const item of required) {
    if (!packagedFiles.includes(item)) throw new Error(`Packed tarball is missing required file: ${item}`);
  }
  for (const item of packagedFiles) {
    if (item.startsWith("dist/") && !publishedModule.test(item)) {
      throw new Error(`Unexpected build output in the npm package: ${item}`);
    }
    if (prohibited.some((pattern) => pattern.test(item))) {
      throw new Error(`Packed tarball contains a prohibited file: ${item}`);
    }
  }

  const tarball = path.join(packDirectory, packageInfo.filename);
  if (!existsSync(tarball)) throw new Error(`npm pack reported a missing tarball: ${tarball}`);

  run("npm", ["init", "--yes"], consumer);
  run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], consumer);

  const examples = path.join(consumer, "node_modules", "acyclic-eval", "dist", "examples");
  const rules = await import(pathToFileURL(path.join(examples, "rule-based-judge", "config.js")).href);
  const adapter = await import(pathToFileURL(path.join(examples, "llm-judge-adapter", "adapter.js")).href);
  if ([rules.generateConfig, rules.evaluateConfig, rules.scoreConfig, adapter.createLlmJudge].some((fn) => typeof fn !== "function")) {
    throw new Error("Installed examples must expose their documented entrypoints.");
  }
  const config = path.join(examples, "toy", "config.js");
  const cli = path.join(consumer, "node_modules", "acyclic-eval", "dist", "src", "cli.js");
  const bin = path.join(consumer, "node_modules", ".bin", "acyclic-eval");
  const directHelp = run(process.execPath, [cli, "--help"], consumer);
  const npxHelp = run("npx", ["--no-install", "acyclic-eval", "--help"], consumer);
  const binHelp = run(bin, ["--help"], consumer);
  for (const [label, output] of [["direct CLI", directHelp], ["npx CLI", npxHelp], ["bin symlink", binHelp]]) {
    if (!output.includes("acyclic-eval <generate|evaluate|score>")) {
      throw new Error(`${label} did not print CLI help.`);
    }
  }

  const libraryImport = run(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      'const api = await import("acyclic-eval"); console.log(typeof api.generate, typeof api.evaluate, typeof api.score);',
    ],
    consumer,
  ).trim();
  if (libraryImport !== "function function function") {
    throw new Error(`Library import regression: expected three functions, got ${libraryImport}`);
  }

  // Mirror the README rather than only invoking the bin file directly. The
  // no-install guard makes an accidental registry download a test failure.
  const generated = run("npx", ["--no-install", "acyclic-eval", "generate", "--config", config, "--out", output], consumer);
  const evaluated = run("npx", ["--no-install", "acyclic-eval", "evaluate", "--config", config, "--out", output, "--samples", "1"], consumer);
  const scored = run("npx", ["--no-install", "acyclic-eval", "score", "--config", config, "--out", output, "--min-coverage", "1"], consumer);

  if (!generated.includes("generated 9 case(s)")) throw new Error("Fresh package did not generate nine toy cases.");
  if (!evaluated.includes('"okSamples": 9')) throw new Error("Fresh package did not evaluate nine successful samples.");
  if (!scored.includes("overall: 9/9 passed") || !scored.includes("gate: PASS")) {
    throw new Error("Fresh package did not produce the expected passing score report.");
  }

  console.log(`verified ${packageInfo.filename}: ${packagedFiles.length} packaged file(s), clean install, and 9/9 toy result`);
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}
