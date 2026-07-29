import type { Comparator, ExpectedSpec } from "../../src/types.js";
import type { ToyVerdict } from "./domain.js";

export const toyComparator: Comparator<ToyVerdict, ToyVerdict> = {
  id: "toy-exact-comparator",
  version: "1.0.0",
  compare(expected: ExpectedSpec<ToyVerdict>, actual: ToyVerdict) {
    if (expected.kind === "equals") {
      return { pass: actual === expected.value, category: actual };
    }
    if (expected.kind === "oneOf") {
      return { pass: expected.values.includes(actual), category: actual };
    }
    return { pass: !expected.values.includes(actual), category: actual };
  },
};
