import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const outputDirectory = fileURLToPath(new URL("../dist/", import.meta.url));
const headersPath = fileURLToPath(new URL("../dist/_headers", import.meta.url));
const cmsConfigPath = fileURLToPath(
  new URL("../dist/admin/config.yml", import.meta.url),
);
const pageCspPlaceholder = "# GENERATED_PUBLIC_CSP_RULES";
const cmsBaseUrlPlaceholder = "__OAUTH_BASE_URL__";
const cmsScopePlaceholder = "__GITHUB_OAUTH_SCOPE__";
const nonProductionRobotsPlaceholder = "  # NON_PRODUCTION_ROBOTS_HEADER";
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
  !headers.includes(pageCspPlaceholder) ||
  !headers.includes(nonProductionRobotsPlaceholder)
) {
  throw new Error("Required header placeholders were not found in dist/_headers.");
}

const scriptHashes = new Set();
const styleHashes = new Set();
const publicPagePatterns = new Set();
for (const path of await htmlFiles(outputDirectory)) {
  const relativePath = relative(outputDirectory, path).replaceAll("\\", "/");
  if (relativePath.startsWith("admin/")) continue;
  if (relativePath === "index.html") {
    publicPagePatterns.add("/");
  } else if (relativePath.includes("/")) {
    publicPagePatterns.add(`/${relativePath.split("/")[0]}/*`);
  } else {
    publicPagePatterns.add(`/${relativePath}`);
  }

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

const publicCsp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  `script-src 'self' 'wasm-unsafe-eval' https://challenges.cloudflare.com ${[...scriptHashes].sort().join(" ")}`,
  `style-src 'self' ${[...styleHashes].sort().join(" ")}`,
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src https://challenges.cloudflare.com https://www.google.com",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");
const publicCspRules = [...publicPagePatterns]
  .sort()
  .map((pattern) => `${pattern}\n  Content-Security-Policy: ${publicCsp}`)
  .join("\n\n");

function originFromEnvironment(name) {
  const value = process.env[name];
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      throw new Error(`${name} must be a canonical HTTPS origin.`);
    }
    return url.origin;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`${name} must be a canonical HTTPS origin.`, {
        cause: error,
      });
    }
    throw error;
  }
}

const publicSiteOrigin = originFromEnvironment("PUBLIC_SITE_URL");
const productionSiteOrigin = originFromEnvironment("PRODUCTION_SITE_URL");
const isProductionOrigin =
  publicSiteOrigin &&
  productionSiteOrigin &&
  publicSiteOrigin === productionSiteOrigin;
const robotsHeader = isProductionOrigin
  ? ""
  : "  X-Robots-Tag: noindex, nofollow";
const updatedHeaders = headers
  .replace(pageCspPlaceholder, publicCspRules)
  .replace(nonProductionRobotsPlaceholder, robotsHeader);
await writeFile(headersPath, updatedHeaders);

let cmsConfig = await readFile(cmsConfigPath, "utf8");
if (
  !cmsConfig.includes(cmsBaseUrlPlaceholder) ||
  !cmsConfig.includes(cmsScopePlaceholder)
) {
  throw new Error("Required OAuth placeholders were not found in admin/config.yml.");
}
const oauthBaseUrl = publicSiteOrigin
  ? `${publicSiteOrigin}/api`
  : "https://invalid.invalid/api";
const oauthScope = process.env.GITHUB_OAUTH_SCOPE || "repo";
if (oauthScope !== "repo" && oauthScope !== "public_repo") {
  throw new Error("GITHUB_OAUTH_SCOPE must be either repo or public_repo.");
}
cmsConfig = cmsConfig
  .replace(cmsBaseUrlPlaceholder, oauthBaseUrl)
  .replace(cmsScopePlaceholder, oauthScope);
await writeFile(cmsConfigPath, cmsConfig);
console.log(
  `CSP updated with ${scriptHashes.size} script and ${styleHashes.size} style hash(es).`,
);
