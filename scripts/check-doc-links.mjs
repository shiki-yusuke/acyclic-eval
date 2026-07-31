import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ignoredDirectories = new Set([".git", "dist", "node_modules"]);

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return ignoredDirectories.has(entry.name) ? [] : markdownFiles(absolute);
    return entry.isFile() && entry.name.endsWith(".md") ? [absolute] : [];
  });
}

const failures = [];
for (const file of markdownFiles(root)) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const raw = match[1].trim().replace(/^<|>$/g, "");
    if (raw === "" || raw.startsWith("#") || /^(?:https?:|mailto:)/.test(raw)) continue;
    const target = raw.split("#", 1)[0];
    if (target === "") continue;
    if (!existsSync(path.resolve(path.dirname(file), target))) {
      failures.push(`${path.relative(root, file)} -> ${raw}`);
    }
  }
}

if (failures.length > 0) {
  throw new Error(`Broken local Markdown link(s):\n${failures.join("\n")}`);
}

console.log(`checked local Markdown links in ${markdownFiles(root).length} file(s)`);
