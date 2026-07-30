// Config module consumable by the CLI: `acyclic-eval generate --config dist/examples/toy/config.js ...`
//
// Each function below does its own dynamic `import()` rather than this file
// statically importing judge.js/comparator.js/etc. at the top level. That
// matters: a static `import { toyJudge } from "./judge.js"` at the top of
// this file would execute as soon as ANY subcommand loads this module --
// including `generate`, which should never need (or load) a Judge
// implementation at all. See docs/threat-model.md and src/cli.ts.

export async function generateConfig() {
  const [{ toyCorpus }, { toyOperators }] = await Promise.all([import("./corpus.js"), import("./operators.js")]);
  return { corpus: toyCorpus, operators: toyOperators };
}

export async function evaluateConfig() {
  const { toyJudge } = await import("./judge.js");
  return { judge: toyJudge };
}

export async function scoreConfig() {
  const { toyComparator } = await import("./comparator.js");
  return { comparator: toyComparator };
}
