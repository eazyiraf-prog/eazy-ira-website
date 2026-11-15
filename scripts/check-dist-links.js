import { readdir, readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import process from "node:process";

const dist = resolve(import.meta.dirname, "..", "dist");
const htmlFiles = [];
const allFiles = new Set();
const htmlByPath = new Map();

async function collect(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error("dist/ does not exist; build the site before checking links.", {
        cause: error,
      });
    }
    throw error;
  }
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await collect(path);
      continue;
    }
    const relativePath = path.slice(dist.length + 1).split(sep).join("/");
    allFiles.add(`/${relativePath}`);
    if (extname(path).toLowerCase() === ".html") {
      htmlFiles.push(path);
      htmlByPath.set(`/${relativePath}`, await readFile(path, "utf8"));
    }
  }
}

await collect(dist);

function targetFile(pathname) {
  let path = decodeURIComponent(pathname.split(/[?#]/, 1)[0]);
  if (!path.startsWith("/")) path = `/${path}`;
  const candidates = [path];
  if (path.endsWith("/")) candidates.push(`${path}index.html`);
  else {
    candidates.push(`${path}/index.html`);
    if (!extname(path)) candidates.push(`${path}.html`);
  }
  return candidates.find((candidate) => allFiles.has(candidate));
}

const errors = [];
for (const [htmlPath, html] of htmlByPath) {
  const ids = new Set(
    [...html.matchAll(/\b(?:id|name)\s*=\s*["']([^"']+)["']/gi)].map(
      (match) => match[1],
    ),
  );
  const references = [
    ...html.matchAll(
      /\b(?:href|src|poster)\s*=\s*["']([^"']+)["']/gi,
    ),
  ];
  for (const match of html.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi)) {
    for (const candidate of match[1].split(",")) {
      const url = candidate.trim().split(/\s+/, 1)[0];
      references.push([match[0], url]);
    }
  }

  for (const reference of references) {
    const value = reference[1].trim();
    if (
      !value ||
      value.startsWith("#") ||
      value.startsWith("//") ||
      /^[a-z][a-z\d+.-]*:/i.test(value) ||
      value.startsWith("data:")
    ) {
      if (value.startsWith("#") && value.length > 1 && !ids.has(value.slice(1))) {
        errors.push(`${htmlPath}: missing fragment target ${value}`);
      }
      continue;
    }
    const url = new URL(value, `https://dist.invalid${htmlPath}`);
    const target = targetFile(url.pathname);
    if (!target) {
      errors.push(`${htmlPath}: missing local target ${url.pathname}`);
    } else if (
      url.hash &&
      htmlByPath.has(target) &&
      !new Set(
        [
          ...htmlByPath
            .get(target)
            .matchAll(/\b(?:id|name)\s*=\s*["']([^"']+)["']/gi),
        ].map((item) => item[1]),
      ).has(decodeURIComponent(url.hash.slice(1)))
    ) {
      errors.push(`${htmlPath}: missing fragment target ${url.pathname}${url.hash}`);
    }
  }
}

if (errors.length) {
  console.error(`Built-site link/image check failed with ${errors.length} issue(s):`);
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Built-site link/image check passed: ${htmlFiles.length} HTML pages and ${allFiles.size} files checked.`,
  );
}
