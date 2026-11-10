import { readFile } from "node:fs/promises";
import process from "node:process";

const locales = ["en", "fr", "rw"];
const dictionaries = Object.fromEntries(
  await Promise.all(
    locales.map(async (locale) => [
      locale,
      JSON.parse(
        await readFile(new URL(`../src/i18n/${locale}.json`, import.meta.url)),
      ),
    ]),
  ),
);
const englishKeys = Object.keys(dictionaries.en);
const missing = [];

for (const locale of ["fr", "rw"]) {
  for (const key of englishKeys) {
    if (!(key in dictionaries[locale])) {
      missing.push(`${locale}.${key}`);
    } else if (
      typeof dictionaries[locale][key] !== "object" ||
      dictionaries[locale][key].needsNativeReview !== true ||
      typeof dictionaries[locale][key].value !== "string"
    ) {
      missing.push(`${locale}.${key} (needs a reviewed translation entry)`);
    }
  }
}

if (missing.length) {
  console.error(`i18n validation failed:\n- ${missing.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(
    `i18n validation passed: ${englishKeys.length} keys exist in en, fr, and rw; all translated entries need native review.`,
  );
}
