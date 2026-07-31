import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const english = readFileSync(path.join(root, "README.md"), "utf8");
const japanese = readFileSync(path.join(root, "README.ja.md"), "utf8");

function marker(text) {
  return text.match(/<!-- docs-sync: ([^>]+) -->/)?.[1];
}

function quickstart(text) {
  return text.match(/^## Quick start\s*\n[\s\S]*?^```bash\n([\s\S]*?)^```/m)?.[1].trim();
}

const englishMarker = marker(english);
const japaneseMarker = marker(japanese);
if (englishMarker === undefined || japaneseMarker === undefined || englishMarker !== japaneseMarker) {
  throw new Error("README.md and README.ja.md must carry the same docs-sync marker.");
}

const englishQuickstart = quickstart(english);
const japaneseQuickstart = quickstart(japanese);
if (englishQuickstart === undefined || japaneseQuickstart === undefined || englishQuickstart !== japaneseQuickstart) {
  throw new Error("README.md and README.ja.md must have the same first Quick start command block.");
}

console.log(`README quickstart and docs-sync marker are aligned (${englishMarker})`);
