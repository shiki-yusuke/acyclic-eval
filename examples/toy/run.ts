// `npm run example`: runs generate -> evaluate -> score end to end against
// the toy domain and prints the resulting report. No network calls, no
// external services -- this is meant to be the Quick Start in README.md.

import path from "node:path";
import { rmSync } from "node:fs";
import { evaluate } from "../../src/evaluate.js";
import { generate } from "../../src/generate.js";
import { score } from "../../src/score.js";
import { formatReport } from "../../src/report.js";
import { toyComparator } from "./comparator.js";
import { toyCorpus } from "./corpus.js";
import { toyJudge } from "./judge.js";
import { toyOperators } from "./operators.js";

async function main(): Promise<void> {
  const outDir = path.join(process.cwd(), ".acyclic-eval-example-out");
  rmSync(outDir, { recursive: true, force: true });

  const generated = generate(outDir, toyOperators, toyCorpus);
  console.log(`[generate] wrote ${generated.manifest.entries.length} case(s) to ${outDir}`);

  const summary = await evaluate(outDir, toyJudge, { concurrency: 2 });
  console.log(`[evaluate] ran ${summary.ranSamples} sample(s), ${summary.okSamples} ok, ${summary.infraErrorSamples} infra errors`);

  const report = score(outDir, toyComparator, { minCoverage: 1 });
  console.log(`[score] ${report.overall.passed}/${report.overall.evaluated} passed -- gate ${report.pass ? "PASS" : "FAIL"}`);
  console.log("");
  console.log(formatReport(report).markdown);

  if (!report.pass) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
