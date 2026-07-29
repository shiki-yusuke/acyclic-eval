// Toy domain: a "run" is a short transcript of shell command lines and their
// result lines (e.g. `$ npm test` followed by `PASS ...` or `FAIL ...`).
// Self-contained -- no evigate types or code are used here.

export interface ToyRun {
  readonly id: string;
  readonly lines: readonly string[];
}

export type ToyVerdict = "pass" | "fail" | "unknown";

export interface ToyCaseInput {
  readonly lines: readonly string[];
}
