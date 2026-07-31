#!/bin/sh
# Run the bundled toy pipeline without touching the checkout or needing a
# network connection. Requires a prior `npm run build`.
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
out_dir=$(mktemp -d "${TMPDIR:-/tmp}/acyclic-eval-demo.XXXXXX")

cleanup() {
  rm -rf "$out_dir"
}
trap cleanup EXIT HUP INT TERM

run() {
  output_file=$(mktemp "$out_dir/output.XXXXXX")
  node "$repo_dir/dist/src/cli.js" "$@" >"$output_file"
  sed "s|$out_dir|<temporary-output>|g; s|_scored at .*_|_scored at <generated-at>_|" "$output_file"
  rm -f "$output_file"
}

run generate --config "$repo_dir/dist/examples/toy/config.js" --out "$out_dir"
run evaluate --config "$repo_dir/dist/examples/toy/config.js" --out "$out_dir" --samples 1
run score --config "$repo_dir/dist/examples/toy/config.js" --out "$out_dir" --min-coverage 1
