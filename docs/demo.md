# Demo

After a local build, run:

```bash
./scripts/demo.sh
```

The script uses a new temporary directory, removes it on exit, makes no
network requests, and normalizes the transient path and score timestamp in its
terminal presentation. The meaningful output is deterministic:

```text
generated 9 case(s) into <temporary-output>
{
  "totalCases": 9,
  "totalSamples": 9,
  "ranSamples": 9,
  "skippedResumedSamples": 0,
  "staleObservationsInvalidated": 0,
  "okSamples": 9,
  "infraErrorSamples": 0
}
# acyclic-eval report

_scored at <generated-at>_

- overall: 9/9 passed (100.0%), 0 infra errors, 9 total cases
- gate: PASS
```

The 9/9 value describes only the bundled toy corpus and rule-based judge. It
is a reproducibility check, not a general judge-accuracy result.
