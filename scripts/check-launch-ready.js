import {
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import process from "node:process";
import { isProductionLaunchGateActive } from "./launch-gate.js";

const root = resolve(import.meta.dirname, "..");
const checklistPath = resolve(root, "docs", "LAUNCH_CHECKLIST.md");
const areas = [
  "Donations and treasurer",
  "Contact and legal",
  "Team and governance",
  "Impact numbers",
  "Programs",
  "News and gallery samples",
  "Documents and PDFs",
  "Translations needing native review",
  "Brand assets",
];
const textExtensions = new Set([
  ".astro",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mdx",
  ".svg",
  ".ts",
  ".txt",
  ".yml",
  ".yaml",
]);
const bracketInstruction =
  /\[[^\]\r\n]{1,160}\]/g;
const instructionWords =
  /\b(confirm(?:ation|ed)?|to be supplied|to be provided|supply|provide|replace|insert|add|enter|verify|treasurer|TODO|TBD|placeholder|your\s+(?:name|email|phone|domain|account|logo|details)|information to be supplied)\b/i;
const findings = [];

const productionGateActive = isProductionLaunchGateActive();

function relativePath(path) {
  return relative(root, path).split(sep).join("/");
}

function areaFor(path) {
  const file = path.toLowerCase();
  if (file.includes("i18n/")) return "Translations needing native review";
  if (file.includes("donat") || file.includes("fundrais") || file.includes("momo")) {
    return "Donations and treasurer";
  }
  if (/\/(?:news|albums|reports)\//.test(file)) {
    return "News and gallery samples";
  }
  if (file.includes("/program")) return "Programs";
  if (file.includes("impact.json")) return "Impact numbers";
  if (file.includes("team") || file.includes("governance") || file.includes("safeguard")) {
    return "Team and governance";
  }
  if (file.endsWith(".pdf") || file.includes("/documents/")) {
    return "Documents and PDFs";
  }
  if (file.includes("logo") || file.includes("brand") || file.includes("design-system")) {
    return "Brand assets";
  }
  if (file.includes("legal") || file.includes("contact") || file.includes("site.json")) {
    return "Contact and legal";
  }
  if (file.startsWith("public/images/")) return "Brand assets";
  return "Contact and legal";
}

function supplyNeeded(path, text) {
  const file = path.toLowerCase();
  const value = text.toLowerCase();
  if (file.includes("impact.json")) return "Confirm the current figure or date and update impact.json.";
  if (file.includes("site.json")) {
    if (value.includes("mtn-momo") || value.includes("paycode")) {
      return "Treasurer must confirm the donation number, payee name, and instructions.";
    }
    if (value.includes("email")) return "Confirm the Foundation contact email.";
    if (value.includes("phone")) return "Supply and confirm the public phone number, or remove the field.";
    if (value.includes("social")) return "Supply and confirm the official social account, or remove the field.";
    return "Supply and confirm the missing organization or donation detail.";
  }
  if (file.endsWith(".pdf")) return "Supply the final approved document PDF.";
  if (file.includes("/news/")) return "Replace with a verified news update and approved image/copy.";
  if (file.includes("/albums/")) return "Supply a real approved album; record guardian consent for any child images.";
  if (file.includes("/reports/")) return "Verify the report date, amounts, quantities, receipts, and publication permission.";
  if (file.includes("i18n/")) return "Have a native speaker review and confirm this translation.";
  if (file.includes("design-system")) return "Keep this private reference page out of the production build.";
  if (value.includes("treasurer") || value.includes("payee")) {
    return "Treasurer must confirm the payee identity and donation instructions.";
  }
  if (value.includes("logo") || value.includes("brand")) return "Supply the approved Foundation logo and brand assets.";
  if (file.includes("/program")) return "Supply the confirmed schedule, eligibility, or program details.";
  return "Supply verified replacement text or the approved asset.";
}

function addFinding({ path, text, kind, blocking = false, area, supply }) {
  const key = `${path}\0${text}\0${kind}`;
  if (findings.some((finding) => finding.key === key)) return;
  findings.push({
    key,
    path,
    text: text.trim().replace(/\s+/g, " "),
    kind,
    blocking,
    area: area ?? areaFor(path),
    supply: supply ?? supplyNeeded(path, text),
  });
}

async function walk(directory, predicate = () => true) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const files = [];
  for (const entry of entries) {
    if (directory === resolve(root, "public") && entry.name === "admin") {
      continue;
    }
    if (!predicate(entry.name, entry.isDirectory())) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path, predicate)));
    else files.push(path);
  }
  return files;
}

const scannedRoots = [
  resolve(root, "src"),
  resolve(root, "public"),
  resolve(root, "docs", "legal"),
];
for (const directory of scannedRoots) {
  const files = await walk(directory, (name, isDirectory) => {
    if (isDirectory && name === "vendor") return false;
    return true;
  });

  for (const file of files) {
    const path = relativePath(file);
    const basename = file.split(/[\\/]/).at(-1);
    const extension = extname(file).toLowerCase();
    const namedPlaceholder = /placeholder/i.test(basename);
    if (namedPlaceholder) {
      const blocking =
        extension === ".pdf" && path.startsWith("public/documents/");
      addFinding({
        path,
        text: `File named "${basename}"`,
        kind: blocking ? "Placeholder PDF" : "Placeholder-named file",
        blocking,
      });
    }

    if (!textExtensions.has(extension)) continue;
    const content = await readFile(file, "utf8");
    const lines = content.split(/\r?\n/);
    const isPublicContent =
      path.startsWith("src/pages/") ||
      path.startsWith("src/content/") ||
      path.startsWith("src/i18n/") ||
      path.startsWith("public/") ||
      path.startsWith("docs/legal/");

    if (isPublicContent) {
      lines.forEach((line) => {
        for (const match of line.matchAll(bracketInstruction)) {
          if (/^\[(?:data-|aria-|href=|class=)/i.test(match[0])) continue;
          if (!instructionWords.test(match[0])) continue;
          const blocking = true;
          addFinding({
            path,
            text: match[0],
            kind: "Bracketed instruction or placeholder",
            blocking,
          });
        }
      });
    }

    if (/^src\/content\/(news|albums|reports)\//.test(path)) {
      const sampleLine = lines.find((line) =>
        /\bsample\s*:\s*true\b|"sample"\s*:\s*true|sample\s+(?:post|album|report)\s*:/i.test(line),
      );
      const sampleTitle = lines.find((line) =>
        /^\s*(?:title:\s*)?["']?sample\b/i.test(line),
      );
      if (sampleLine || sampleTitle || /sample/i.test(basename)) {
        const line = sampleLine ?? sampleTitle ?? `File name: ${basename}`;
        addFinding({
          path,
          text: line,
          kind: "Sample news, album, or report",
          blocking: true,
        });
      } else if (
        path.startsWith("src/content/reports/") &&
        /\[(?:confirm|to be supplied|to be confirmed)[^\]]*\]/i.test(content)
      ) {
        addFinding({
          path,
          text: "Report contains confirmation placeholders and is not publication-ready.",
          kind: "Incomplete report",
          blocking: true,
        });
      }
    }

    if (path === "src/components/DesignSystemPage.astro") {
      addFinding({
        path,
        text: "Route /design-system/ (source page)",
        kind: "Private design-system page",
        blocking: false,
        area: "Brand assets",
        supply: "The production gate must exclude this page and all localized equivalents.",
      });
    }

    if (extension === ".json") {
      let data;
      try {
        data = JSON.parse(content);
      } catch {
        continue;
      }
      const nativeReview = (node, nodePath = "$") => {
        if (Array.isArray(node)) {
          node.forEach((value, index) => nativeReview(value, `${nodePath}[${index}]`));
        } else if (node && typeof node === "object") {
          const isDonationMethod =
            path === "src/data/site.json" &&
            /^\$\.donation\.methods\[\d+\]$/.test(nodePath);
          const isDisabledDonation = isDonationMethod && node.enabled === false;
          const isEnabledDonation = isDonationMethod && node.enabled === true;
          if (isDisabledDonation) {
            addFinding({
              path,
              text: `${nodePath} (${node.id ?? "donation method"}) is disabled`,
              kind: "Disabled donation method",
              blocking: false,
              area: "Donations and treasurer",
              supply: "Not shown on the site because this donation method is disabled.",
            });
          }
          if (isEnabledDonation) {
            const inspectPlaceholders = (value, valuePath) => {
              if (typeof value === "string") {
                for (const match of value.matchAll(bracketInstruction)) {
                  if (!instructionWords.test(match[0])) continue;
                  addFinding({
                    path,
                    text: `${valuePath}: ${match[0]}`,
                    kind: "Donation method placeholder",
                    blocking: true,
                    area: "Donations and treasurer",
                  });
                }
              } else if (Array.isArray(value)) {
                value.forEach((entry, index) =>
                  inspectPlaceholders(entry, `${valuePath}[${index}]`),
                );
              } else if (value && typeof value === "object") {
                Object.entries(value).forEach(([key, entry]) =>
                  inspectPlaceholders(entry, `${valuePath}.${key}`),
                );
              }
            };
            inspectPlaceholders(node, nodePath);
          }
          if (node.needsNativeReview === true && typeof node.value === "string") {
            addFinding({
              path,
              text: `${nodePath}.needsNativeReview: true — ${node.value}`,
              kind: "Native review required",
              blocking: false,
              area: "Translations needing native review",
              supply: "Have a native speaker review and confirm this translation.",
            });
          }
          Object.entries(node).forEach(([key, value]) => {
            if (
              key === "needsConfirmation" &&
              value === true &&
              !isDisabledDonation
            ) {
              const isDataJson =
                path === "src/data/site.json" || path === "src/data/impact.json";
              const isEnabledDonation =
                path === "src/data/site.json" &&
                /^\$\.donation\.methods\[\d+\]$/.test(nodePath) &&
                node.enabled === true;
              const isDisabledDonation =
                path === "src/data/site.json" &&
                /^\$\.donation\.methods\[\d+\]$/.test(nodePath) &&
                node.enabled === false;
              const blocking =
                (isDataJson && !isDisabledDonation && !nodePath.startsWith("$.donation.methods[")) ||
                isEnabledDonation;
              const methodId =
                typeof node.id === "string" ? ` (${node.id})` : "";
              const area =
                path === "src/data/site.json" &&
                nodePath.startsWith("$.donation.methods")
                  ? "Donations and treasurer"
                  : undefined;
              addFinding({
                path,
                text: `${nodePath}.${key}: true${methodId}`,
                kind: "Unconfirmed value",
                blocking,
                area,
              });
            }
            nativeReview(value, `${nodePath}.${key}`);
          });
        }
      };
      nativeReview(data);
    }
  }
}

const sortedFindings = findings.sort(
  (a, b) =>
    areas.indexOf(a.area) - areas.indexOf(b.area) ||
    a.path.localeCompare(b.path) ||
    a.text.localeCompare(b.text),
);
const blockers = sortedFindings.filter((finding) => finding.blocking);
const warnings = sortedFindings.filter((finding) => !finding.blocking);
const grouped = Object.fromEntries(areas.map((area) => [area, []]));
for (const finding of sortedFindings) grouped[finding.area].push(finding);

const lines = [
  "# Launch checklist",
  "",
  "Generated by `npm run check:launch`; regenerated on every run. Do not edit by hand.",
  "",
  `Production gate: **${productionGateActive ? "active (configured origins match)" : "inactive (origins differ or are unset)"}**.`,
  `Potential production blockers: **${blockers.length}**; warnings and items to confirm: **${warnings.length}**.`,
  "",
];

for (const area of areas) {
  const entries = grouped[area];
  lines.push(
    `## ${area} (${entries.filter((entry) => entry.blocking).length} blockers; ${entries.filter((entry) => !entry.blocking).length} warnings)`,
    "",
  );
  if (!entries.length) {
    lines.push("- None found.", "");
    continue;
  }
  for (const finding of entries) {
    const severity = finding.blocking ? "BLOCKER" : "WARNING";
    lines.push(
      `- **${severity}** \`${finding.path}\` — \`${finding.text.replaceAll("`", "\\`")}\` — Supply/action: ${finding.supply}`,
    );
  }
  lines.push("");
}
await writeFile(checklistPath, `${lines.join("\n")}\n`, "utf8");

console.log(
  `Launch checklist written to docs/LAUNCH_CHECKLIST.md (${blockers.length} potential blockers; ${warnings.length} warnings).`,
);
if (productionGateActive && blockers.length) {
  console.error(
    `Production launch gate blocked the build. First blocking items:\n${blockers
      .slice(0, 10)
      .map((finding) => `- ${finding.path}: ${finding.text}`)
      .join("\n")}`,
  );
  process.exitCode = 1;
} else if (productionGateActive) {
  console.log("Production launch gate passed.");
} else {
  console.warn(
    "Production launch gate inactive; findings are warnings and the build may continue.",
  );
}
