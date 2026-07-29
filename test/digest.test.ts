import { describe, expect, it } from "vitest";
import { canonicalStringify, digestOfValue, sha256Hex } from "../src/digest.js";

describe("canonicalStringify", () => {
  it("is insensitive to key insertion order", () => {
    const a = { b: 1, a: 2, c: { y: 1, x: 2 } };
    const b = { a: 2, c: { x: 2, y: 1 }, b: 1 };
    expect(canonicalStringify(a)).toBe(canonicalStringify(b));
  });

  it("preserves array order", () => {
    expect(canonicalStringify([1, 2, 3])).not.toBe(canonicalStringify([3, 2, 1]));
  });

  it("drops undefined object properties like JSON.stringify does", () => {
    expect(canonicalStringify({ a: 1, b: undefined })).toBe(canonicalStringify({ a: 1 }));
  });
});

describe("digestOfValue", () => {
  it("produces the same digest for structurally equal values regardless of key order", () => {
    expect(digestOfValue({ x: 1, y: 2 })).toBe(digestOfValue({ y: 2, x: 1 }));
  });

  it("produces different digests for different values", () => {
    expect(digestOfValue({ x: 1 })).not.toBe(digestOfValue({ x: 2 }));
  });

  it("matches a direct sha256Hex of the canonical string", () => {
    const value = { x: 1 };
    expect(digestOfValue(value)).toBe(sha256Hex(canonicalStringify(value)));
  });
});
