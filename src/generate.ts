// generate: corpus -> manifest. Runs every operator's selectMaterials/mutate/
// selfValidate and writes the JSON-compatible manifest + content-addressed
// artifacts. Never touches a Judge (there isn't one in scope here).

import { composeCaseId } from "./case-id.js";
import { digestOfValue } from "./digest.js";
import { AcyclicEvalError } from "./errors.js";
import { writeArtifact, writeManifest } from "./manifest.js";
import type { GenerationOperatorStats, Manifest, ManifestEntry, MutationOperator } from "./types.js";

export interface GenerateResult {
  readonly manifest: Manifest;
  readonly operatorStats: readonly GenerationOperatorStats[];
}

export async function generate<TSource, TCaseInput, TExpected>(
  outDir: string,
  operators: ReadonlyArray<MutationOperator<TSource, TCaseInput, TExpected>>,
  corpus: readonly TSource[],
): Promise<GenerateResult> {
  const entries: ManifestEntry[] = [];
  const operatorStats: GenerationOperatorStats[] = [];
  const seenGlobalCaseIds = new Set<string>();

  for (const operator of operators) {
    const materials = operator.selectMaterials(corpus);
    let candidatesGenerated = 0;
    let structurallyValid = 0;
    const skipped: Array<{ caseId?: string; reason: string }> = [];

    for (const material of materials) {
      const candidates = operator.mutate(material);
      const seenLocalIds = new Set<string>();
      for (const candidate of candidates) {
        if (seenLocalIds.has(candidate.caseId)) {
          throw new AcyclicEvalError(
            `operator "${operator.id}" produced two candidates with the same local caseId ` +
              `"${candidate.caseId}" for the same material. Local caseIds must be unique within a ` +
              `single mutate() call (e.g. use a running index or a content hash of the mutation).`,
          );
        }
        seenLocalIds.add(candidate.caseId);
        candidatesGenerated += 1;

        if (candidate.target === undefined) {
          skipped.push({ caseId: candidate.caseId, reason: "candidate.target is undefined (a target is required)" });
          continue;
        }

        const validation = await operator.selfValidate(material, candidate);
        if (!validation.valid) {
          skipped.push({ caseId: candidate.caseId, reason: validation.reason ?? "selfValidate reported invalid (no reason given)" });
          continue;
        }

        const sourceDigest = digestOfValue(material.source);
        const fullCaseId = composeCaseId(operator.id, operator.version, sourceDigest, candidate.caseId);
        if (seenGlobalCaseIds.has(fullCaseId)) {
          throw new AcyclicEvalError(
            `duplicate global caseId "${fullCaseId}" produced by operator "${operator.id}". This means two ` +
              `materials with identical source content produced candidates with the same local caseId -- ` +
              `make the local caseId depend on more than just a running index (e.g. include a content hash).`,
          );
        }
        seenGlobalCaseIds.add(fullCaseId);
        structurallyValid += 1;

        const { artifactUri, artifactDigest } = writeArtifact(outDir, fullCaseId, candidate.input);
        entries.push({
          schemaVersion: 1,
          caseId: fullCaseId,
          operatorId: operator.id,
          operatorVersion: operator.version,
          artifactUri,
          artifactDigest,
          sourceDigest,
          target: candidate.target,
          expected: candidate.expected,
          tags: candidate.tags ?? [],
        });
      }
    }

    operatorStats.push({
      operatorId: operator.id,
      operatorVersion: operator.version,
      materialsSelected: materials.length,
      candidatesGenerated,
      structurallyValid,
      skipped,
    });
  }

  const manifest = writeManifest(outDir, entries, operatorStats);
  return { manifest, operatorStats };
}
