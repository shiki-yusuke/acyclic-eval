import type { ToyRun } from "./domain.js";

export const toyCorpus: ToyRun[] = [
  {
    id: "run-1",
    lines: ["setup complete", "$ npm test", "PASS 12 passed", "Done in 1.2s"],
  },
  {
    id: "run-2",
    lines: ["$ npm test", "PASS 3 passed"],
  },
  {
    id: "run-3",
    lines: ["$ npm lint", "no errors", "$ npm test", "PASS 5 passed", "wrap up"],
  },
  {
    id: "run-4-no-test",
    lines: ["$ npm build", "build ok"],
  },
];
