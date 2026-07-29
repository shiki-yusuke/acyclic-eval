// Three operators over the toy log domain: two recall-side (evidence that
// should be missing must not still yield "pass") and one precision-side (an
// unrelated earlier failure must not flip a genuinely-passing last block to
// "fail"). Between them they exercise all three ExpectedSpec kinds.

import { expectEquals, expectForbid, expectOneOf } from "../../src/types.js";
import type { Material, MutantCandidate, MutationOperator, ValidationResult } from "../../src/types.js";
import type { ToyCaseInput, ToyRun, ToyVerdict } from "./domain.js";
import { lastCommandBlock } from "./locator.js";

const COMMAND_PREFIX = "$ npm test";

function selectPassingRuns(corpus: readonly ToyRun[]): Material<ToyRun>[] {
  const materials: Material<ToyRun>[] = [];
  for (const run of corpus) {
    const block = lastCommandBlock(run.lines, COMMAND_PREFIX);
    if (!block || block.resultLine === undefined || !block.resultLine.startsWith("PASS")) continue;
    materials.push({ source: run, anchor: { commandIndex: block.commandIndex, resultIndex: block.resultIndex } });
  }
  return materials;
}

/** M-recall-1: delete the result line right after the passing command -- the judge must not still say "pass". */
export const removeResultLine: MutationOperator<ToyRun, ToyCaseInput, ToyVerdict> = {
  id: "toy-remove-result-line",
  version: "1.0.0",
  selectMaterials: selectPassingRuns,
  mutate(material): MutantCandidate<ToyCaseInput, ToyVerdict>[] {
    const commandIndex = material.anchor.commandIndex as number;
    const resultIndex = material.anchor.resultIndex as number;
    const lines = material.source.lines.filter((_, idx) => idx !== resultIndex);
    return [
      {
        caseId: "0",
        input: { lines },
        target: { commandIndex },
        expected: expectForbid<ToyVerdict>(["pass"]),
        trace: { description: "removed the result line right after the passing test command" },
        tags: ["recall"],
      },
    ];
  },
  selfValidate(material, candidate): ValidationResult {
    if (candidate.input.lines.length !== material.source.lines.length - 1) {
      return { valid: false, reason: "expected exactly one line to be removed" };
    }
    if (candidate.input.lines.join("\n") === material.source.lines.join("\n")) {
      return { valid: false, reason: "no-op mutation: content unchanged" };
    }
    return { valid: true };
  },
};

/** M-precision-1: inject an earlier, unrelated failing block. The judge only looks at the *last* block, so it must still say "pass". */
export const injectEarlierFailure: MutationOperator<ToyRun, ToyCaseInput, ToyVerdict> = {
  id: "toy-inject-earlier-failure",
  version: "1.0.0",
  selectMaterials: selectPassingRuns,
  mutate(material): MutantCandidate<ToyCaseInput, ToyVerdict>[] {
    const commandIndex = material.anchor.commandIndex as number;
    const injected = [COMMAND_PREFIX, "FAIL 1 test failed (unrelated, injected)"];
    const lines = [...injected, ...material.source.lines];
    return [
      {
        caseId: "0",
        input: { lines },
        target: { commandIndex: commandIndex + injected.length },
        expected: expectEquals<ToyVerdict>("pass"),
        trace: { description: "injected an unrelated earlier failing block before the real passing block" },
        tags: ["precision"],
      },
    ];
  },
  selfValidate(material, candidate): ValidationResult {
    if (candidate.input.lines.length !== material.source.lines.length + 2) {
      return { valid: false, reason: "expected exactly two lines to be inserted" };
    }
    if (candidate.input.lines.join("\n") === material.source.lines.join("\n")) {
      return { valid: false, reason: "no-op mutation: content unchanged" };
    }
    return { valid: true };
  },
};

/** M-recall-2: truncate everything from the command line onward -- no evidence at all must not still yield a definite verdict. */
export const truncateAfterCommand: MutationOperator<ToyRun, ToyCaseInput, ToyVerdict> = {
  id: "toy-truncate-after-command",
  version: "1.0.0",
  selectMaterials: selectPassingRuns,
  mutate(material): MutantCandidate<ToyCaseInput, ToyVerdict>[] {
    const commandIndex = material.anchor.commandIndex as number;
    const lines = material.source.lines.slice(0, commandIndex + 1);
    return [
      {
        caseId: "0",
        input: { lines },
        target: { commandIndex },
        expected: expectOneOf<ToyVerdict>(["unknown", "fail"]),
        trace: { description: "truncated the transcript right after the test command, leaving no result evidence" },
        tags: ["recall"],
      },
    ];
  },
  selfValidate(material, candidate): ValidationResult {
    if (candidate.input.lines.length >= material.source.lines.length) {
      return { valid: false, reason: "expected the transcript to shrink" };
    }
    if (candidate.input.lines.join("\n") === material.source.lines.join("\n")) {
      return { valid: false, reason: "no-op mutation: content unchanged" };
    }
    return { valid: true };
  },
};

export const toyOperators = [removeResultLine, injectEarlierFailure, truncateAfterCommand];
