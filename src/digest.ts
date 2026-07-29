import { createHash } from "node:crypto";

/**
 * Deterministic JSON stringification: object keys are sorted recursively so
 * that the same logical value always hashes to the same digest regardless of
 * property insertion order. `undefined` values are dropped (matching
 * JSON.stringify's own behavior for object properties).
 */
export function canonicalStringify(value: unknown): string {
  return stringify(value);
}

function stringify(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => stringify(v)).join(",")}]`;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stringify(obj[k])}`).join(",")}}`;
  }
  throw new TypeError(`canonicalStringify: unsupported value type ${typeof value}`);
}

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function digestOfValue(value: unknown): string {
  return sha256Hex(canonicalStringify(value));
}
