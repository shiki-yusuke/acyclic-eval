// Config module consumable by the CLI: `acyclic-eval generate --config examples/toy/config.js ...`

import { toyComparator } from "./comparator.js";
import { toyCorpus } from "./corpus.js";
import { toyJudge } from "./judge.js";
import { toyOperators } from "./operators.js";

export const corpus = toyCorpus;
export const operators = toyOperators;
export const judge = toyJudge;
export const comparator = toyComparator;
