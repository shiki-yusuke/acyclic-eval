// Type-level assertions (compile-time only; `npm test` runs `tsc --noEmit`
// before vitest, so a type regression here fails the suite even though these
// assertions are runtime no-ops).
import { describe, expectTypeOf, it } from "vitest";
import { expectEquals, expectForbid, expectOneOf } from "../src/types.js";
import type {
  Comparator,
  ExpectedSpec,
  Judge,
  ManifestEntry,
  Material,
  MutantCandidate,
  MutationOperator,
} from "../src/types.js";

describe("type-level contracts", () => {
  it("ExpectedSpec is a discriminated union of equals/oneOf/forbid", () => {
    expectTypeOf(expectEquals("x")).toEqualTypeOf<ExpectedSpec<string>>();
    expectTypeOf(expectOneOf(["x", "y"])).toEqualTypeOf<ExpectedSpec<string>>();
    expectTypeOf(expectForbid(["x"])).toEqualTypeOf<ExpectedSpec<string>>();
    expectTypeOf<ExpectedSpec<string>>().toMatchTypeOf<{ kind: "equals" | "oneOf" | "forbid" }>();
  });

  it("MutationOperator's methods never mention a Judge type in their signatures", () => {
    expectTypeOf<MutationOperator<number, string, boolean>>().toHaveProperty("selectMaterials");
    expectTypeOf<MutationOperator<number, string, boolean>["selectMaterials"]>().parameter(0).toEqualTypeOf<readonly number[]>();
    expectTypeOf<MutationOperator<number, string, boolean>["mutate"]>().parameter(0).toEqualTypeOf<Material<number>>();
    expectTypeOf<MutationOperator<number, string, boolean>["mutate"]>().returns.toEqualTypeOf<MutantCandidate<string, boolean>[]>();
  });

  it("Judge.evaluate takes only TCaseInput and a context (no expected value, no operator metadata)", () => {
    type Ctx = Parameters<Judge<string, boolean>["evaluate"]>[1];
    expectTypeOf<Ctx>().toHaveProperty("sampleIndex");
    expectTypeOf<Ctx>().not.toHaveProperty("expected");
  });

  it("Comparator.compare takes an ExpectedSpec<TExpected> and a bare TActual", () => {
    expectTypeOf<Comparator<string, boolean>["compare"]>().parameter(0).toEqualTypeOf<ExpectedSpec<string>>();
    expectTypeOf<Comparator<string, boolean>["compare"]>().parameter(1).toEqualTypeOf<boolean>();
  });

  it("ManifestEntry is a JSON-compatible protocol that never inlines TCaseInput", () => {
    expectTypeOf<ManifestEntry>().not.toHaveProperty("input");
    expectTypeOf<ManifestEntry>().toHaveProperty("artifactUri").toEqualTypeOf<string>();
    expectTypeOf<ManifestEntry>().toHaveProperty("artifactDigest").toEqualTypeOf<string>();
  });
});
