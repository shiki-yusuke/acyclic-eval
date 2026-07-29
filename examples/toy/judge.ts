// The toy "judge" under evaluation: a small rule-based classifier that looks
// at the *last* `$ npm test` command in a log and reads off the verdict from
// the line right after it. This is intentionally simple and intentionally
// has a blind spot (an earlier failing block doesn't affect its verdict) so
// the example's operators have something meaningful to probe.

import type { Judge } from "../../src/types.js";
import type { ToyCaseInput, ToyVerdict } from "./domain.js";

const COMMAND_PREFIX = "$ npm test";

export const toyJudge: Judge<ToyCaseInput, ToyVerdict> = {
  id: "toy-log-judge",
  version: "1.0.0",
  evaluate(input): ToyVerdict {
    let lastCommandIndex = -1;
    for (let i = 0; i < input.lines.length; i++) {
      if (input.lines[i]!.startsWith(COMMAND_PREFIX)) lastCommandIndex = i;
    }
    if (lastCommandIndex === -1) return "unknown";
    const resultLine = input.lines[lastCommandIndex + 1];
    if (resultLine === undefined) return "unknown";
    if (resultLine.startsWith("PASS")) return "pass";
    if (resultLine.startsWith("FAIL")) return "fail";
    return "unknown";
  },
};
