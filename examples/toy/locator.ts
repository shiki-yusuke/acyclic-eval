// A purely syntactic locator, independent of the judge under test: it finds
// "$ <command>" lines and the line right after them, without ever deciding
// pass/fail. Operators use this to select materials and place mutations.
// It must stay independent from `judge.ts` -- if the operator instead reused
// the judge's own pass/fail logic to pick where to mutate, a bug in that
// logic could silently exclude the very mutants that would expose it (the
// same failure mode this framework exists to avoid; see docs/threat-model.md).

export interface CommandBlock {
  readonly commandIndex: number;
  readonly command: string;
  readonly resultIndex?: number;
  readonly resultLine?: string;
}

export function findCommandBlocks(lines: readonly string[], commandPrefix: string): CommandBlock[] {
  const blocks: CommandBlock[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.startsWith(commandPrefix)) continue;
    const resultIndex = i + 1 < lines.length ? i + 1 : undefined;
    blocks.push({
      commandIndex: i,
      command: line,
      resultIndex,
      resultLine: resultIndex !== undefined ? lines[resultIndex] : undefined,
    });
  }
  return blocks;
}

export function lastCommandBlock(lines: readonly string[], commandPrefix: string): CommandBlock | undefined {
  const blocks = findCommandBlocks(lines, commandPrefix);
  return blocks[blocks.length - 1];
}
