// Case id composition. `MutantCandidate.caseId` only needs to be unique
// among the candidates one `mutate()` call returns for one material (the
// operator's job); this module combines it with the operator identity and a
// digest of the source material to produce the globally stable id that ends
// up in ManifestEntry.caseId. Collisions can only happen if an operator
// reuses the same local caseId twice for the same material -- that is
// detected explicitly (see generate.ts) rather than silently overwritten.

export function composeCaseId(operatorId: string, operatorVersion: string, sourceDigest: string, localCaseId: string): string {
  return `${operatorId}@${operatorVersion}:${sourceDigest.slice(0, 16)}:${localCaseId}`;
}
