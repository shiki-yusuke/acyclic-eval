// Case id composition. `MutantCandidate.caseId` only needs to be unique
// among the candidates one `mutate()` call returns for one material (the
// operator's job); this module combines it with the operator identity and a
// digest of the source material to produce the globally stable id that ends
// up in ManifestEntry.caseId.
//
// The source digest is truncated to 16 hex chars (64 bits) for readability,
// which means caseId uniqueness isn't a mathematical guarantee from the full
// digest space -- two *different* source materials could in principle share
// both a 16-hex-char digest prefix and the same local caseId (astronomically
// unlikely for realistic corpus sizes, but not impossible by construction).
// generate.ts checks for exactly this: it detects any resulting caseId
// collision (whether from digest-prefix collision or from an operator
// reusing a local caseId within one material) and throws rather than
// silently overwriting one entry with another.

export function composeCaseId(operatorId: string, operatorVersion: string, sourceDigest: string, localCaseId: string): string {
  return `${operatorId}@${operatorVersion}:${sourceDigest.slice(0, 16)}:${localCaseId}`;
}
