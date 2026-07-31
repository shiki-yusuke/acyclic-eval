# 30-second demo script

## Goal

Show the three independent stages and their output without presenting the toy
result as a general Judge-accuracy number.

## Terminal sequence

```bash
git clone https://github.com/shiki-yusuke/acyclic-eval.git
cd acyclic-eval
npm ci
npm run demo
```

## Narration

1. “First, generation writes nine cases without loading the Judge.”
2. “Next, the Judge sees only inputs and writes observations.”
3. “Finally, the Comparator re-scores those observations: 9/9 for this tiny
   deterministic toy corpus.”
4. “That proves the demo path works. It does not prove an LLM or a production
   Judge is 100% accurate; corpus provenance, coverage, and the threat model
   remain part of the result.”

For a local recording, `npm run demo` cleans up its temporary output; do not
record real prompts, transcripts, user names, or local file paths. The published
`0.1.4` package has also been verified through the npm bin path and the packaged
generate → evaluate → score sequence.
