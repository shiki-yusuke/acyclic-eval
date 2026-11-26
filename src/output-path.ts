import { lstatSync, realpathSync, statSync } from "node:fs";
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
  try {
    let existing = target;
    while (!lstatSync(existing, { throwIfNoEntry: false })) {
      if (path.relative(root, existing) === "") return target;
      existing = path.dirname(existing);
    }

    const realRoot = realpathSync(root);
    const realExisting = realpathSync(existing);
    checkWithin(realRoot, realExisting);
    if (existing !== target && !statSync(realExisting).isDirectory()) {
      throw new AcyclicEvalError(`parent of bundle file "${file}" must be a directory`);
    }
    return path.join(realExisting, path.relative(existing, target));
  } catch (error) {
    if (error instanceof AcyclicEvalError) throw error;
    throw new AcyclicEvalError(`cannot resolve bundle file "${file}": ${(error as Error).message}`);
  }
}
