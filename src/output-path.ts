import { lstatSync, realpathSync } from "node:fs";
import path from "node:path";
import { AcyclicEvalError } from "./errors.js";

function checkWithin(root: string, target: string): void {
  const relative = path.relative(root, target);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new AcyclicEvalError(`output path escape: "${target}" resolves outside "${root}"`);
  }
}

/** Resolve a bundle file, including a new file below an existing directory. */
export function resolveOutputPath(outDir: string, file: string): string {
  const root = path.resolve(outDir);
  const target = path.resolve(root, file);
  checkWithin(root, target);

  // A new output may have missing parents. lstat also sees dangling links,
  // which must fail resolution rather than being treated as new files.
  let existing = target;
  while (existing !== root && !lstatSync(existing, { throwIfNoEntry: false })) {
    existing = path.dirname(existing);
  }
  if (existing === root) return target;

  const realRoot = realpathSync(root);
  const realExisting = realpathSync(existing);
  checkWithin(realRoot, realExisting);
  return path.join(realExisting, path.relative(existing, target));
}
