# Rule-based judge example

This is the named entry point for the self-contained rule-based example in
[`../toy/`](../toy/). It evaluates a tiny transcript judge with three mutation
operators and requires no network, credentials, or vendor SDK.

After `npm run build`, run the full three-stage pipeline from a temporary
output directory:

```bash
out="$(mktemp -d)"
node dist/src/cli.js generate --config dist/examples/rule-based-judge/config.js --out "$out"
node dist/src/cli.js evaluate --config dist/examples/rule-based-judge/config.js --out "$out"
node dist/src/cli.js score --config dist/examples/rule-based-judge/config.js --out "$out" --min-coverage 1
rm -rf "$out"
```

The expected result is 9/9 passing cases. That result validates this tiny
example only; it is not an accuracy claim about a general-purpose judge.
