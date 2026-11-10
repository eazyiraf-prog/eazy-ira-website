import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const outputDirectory = fileURLToPath(new URL("../dist/", import.meta.url));
const headersPath = fileURLToPath(new URL("../dist/_headers", import.meta.url));
const scriptPlaceholder = "__INLINE_SCRIPT_HASHES__";
const stylePlaceholder = "__INLINE_STYLE_HASHES__";
const inlineScriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const inlineStylePattern = /<style\b([^>]*)>([\s\S]*?)<\/style>/gi;

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return htmlFiles(path);
      return entry.isFile() && entry.name.endsWith(".html") ? [path] : [];
    }),
  );
  return nested.flat();
}

const headers = await readFile(headersPath, "utf8");
if (
  !headers.includes(scriptPlaceholder) ||
  !headers.includes(stylePlaceholder)
) {
  throw new Error("CSP hash placeholders were not found in dist/_headers.");
}

const scriptHashes = new Set();
const styleHashes = new Set();
for (const path of await htmlFiles(outputDirectory)) {
  const html = await readFile(path, "utf8");
  for (const match of html.matchAll(inlineScriptPattern)) {
    if (/(?:^|\s)src\s*=/.test(match[1])) continue;
    const digest = createHash("sha256")
      .update(match[2], "utf8")
      .digest("base64");
    scriptHashes.add(`'sha256-${digest}'`);
  }
  for (const match of html.matchAll(inlineStylePattern)) {
    const digest = createHash("sha256")
      .update(match[2], "utf8")
      .digest("base64");
    styleHashes.add(`'sha256-${digest}'`);
  }
}

if (scriptHashes.size === 0) {
  throw new Error("No inline scripts found; refusing to emit an incomplete CSP.");
}
if (styleHashes.size === 0) {
  throw new Error("No inline styles found; refusing to emit an incomplete CSP.");
}

await writeFile(
  headersPath,
  headers
    .replace(scriptPlaceholder, [...scriptHashes].sort().join(" "))
    .replace(stylePlaceholder, [...styleHashes].sort().join(" ")),
);
console.log(
  `CSP updated with ${scriptHashes.size} script and ${styleHashes.size} style hash(es).`,
);
