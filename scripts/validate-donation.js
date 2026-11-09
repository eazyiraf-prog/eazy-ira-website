import { readFileSync } from "node:fs";
import process from "node:process";

const { donation } = JSON.parse(
  readFileSync(new URL("../src/data/site.json", import.meta.url), "utf8"),
);
const isProductionBuild =
  process.argv.includes("--production") ||
  process.env.NODE_ENV === "production" ||
  ["production", "deploy-preview"].includes(process.env.CONTEXT) ||
  process.env.CI === "true";

if (!isProductionBuild) {
  process.exit(0);
}

const bracketedTextPattern = /\[[^\]]*\]/;

function stringsIn(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(stringsIn);
  }
  return [];
}

for (const method of donation.methods) {
  if (!method.enabled) continue;

  const containsPlaceholder = stringsIn(method).some(
    (value) => bracketedTextPattern.test(value),
  );
  const missingLink = method.type === "link" && !method.url;

  if (containsPlaceholder || missingLink) {
    console.error(
      `Production build blocked: enabled donation method "${method.id}" contains placeholder text or is missing required details. Supply its confirmed details before enabling it.`,
    );
    process.exitCode = 1;
    break;
  }
}
