import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const adminDirectory = join(root, "public", "admin");
const cmsPackagePath = join(root, "node_modules", "@sveltia", "cms");
const cmsPackage = JSON.parse(
  await readFile(join(cmsPackagePath, "package.json"), "utf8"),
);
const cmsBundlePath = join(cmsPackagePath, "dist", "sveltia-cms.js");
let cmsBundle = await readFile(cmsBundlePath, "utf8");

const rewrites = new Map([
  [
    "https://unpkg.com/@sveltia/cms/package.json",
    "/admin/package.json",
  ],
  [
    "https://unpkg.com/@sveltia/cms/dist/sveltia-cms.js",
    "/admin/sveltia-cms.js",
  ],
  [
    "https://unpkg.com/@sveltia/cms@${ak}/dist/",
    "/admin/",
  ],
  ["https://unpkg.com/@shikijs", "/admin/vendor/@shikijs"],
  ["https://unpkg.com/@sveltia/ui", "/admin/vendor/@sveltia/ui"],
]);

for (const [remote, local] of rewrites) {
  if (!cmsBundle.includes(remote)) {
    throw new Error(`Expected CMS bundle URL was not found: ${remote}`);
  }
  cmsBundle = cmsBundle.replaceAll(remote, local);
}

if (!cmsBundle.includes("https://unpkg.com/")) {
  throw new Error("The pinned CMS bundle no longer contains its expected asset URLs.");
}
cmsBundle = cmsBundle.replaceAll("https://unpkg.com/", "/admin/vendor/");
if (cmsBundle.includes("https://unpkg.com/")) {
  throw new Error("The generated CMS bundle still references UNPKG.");
}

await mkdir(adminDirectory, { recursive: true });
await writeFile(join(adminDirectory, "sveltia-cms.js"), cmsBundle);
await writeFile(
  join(adminDirectory, "package.json"),
  JSON.stringify({ version: cmsPackage.version }),
);

const vendorDirectory = join(adminDirectory, "vendor");
const versionedCmsDirectory = join(
  vendorDirectory,
  "@sveltia",
  `cms@${cmsPackage.version}`,
);
await cp(join(cmsPackagePath, "dist"), join(versionedCmsDirectory, "dist"), {
  recursive: true,
});
await cp(
  join(cmsPackagePath, "dist", "chunks"),
  join(adminDirectory, "chunks"),
  { recursive: true },
);
await cp(
  join(cmsPackagePath, "locales"),
  join(versionedCmsDirectory, "locales"),
  { recursive: true },
);
await cp(
  join(cmsPackagePath, "schema"),
  join(vendorDirectory, "@sveltia", "cms", "schema"),
  { recursive: true },
);

for (const [packageName, expectedVersion] of [
  ["@shikijs/langs", "4.5.0"],
  ["@shikijs/themes", "4.5.0"],
  ["@sveltia/ui", "0.88.0"],
]) {
  const packageDirectory = join(root, "node_modules", ...packageName.split("/"));
  const packageMetadata = JSON.parse(
    await readFile(join(packageDirectory, "package.json"), "utf8"),
  );
  if (packageMetadata.version !== expectedVersion) {
    throw new Error(
      `${packageName} must be ${expectedVersion}; found ${packageMetadata.version}.`,
    );
  }
  const destination = join(
    adminDirectory,
    "vendor",
    ...packageName.split("/").slice(0, -1),
    `${packageName.split("/").at(-1)}@${expectedVersion}`,
    "dist",
  );
  await mkdir(dirname(destination), { recursive: true });
  await cp(join(packageDirectory, "dist"), destination, { recursive: true });
}

for (const packageName of ["dayjs", "leaflet", "pdfjs-dist"]) {
  const packageDirectory = join(root, "node_modules", ...packageName.split("/"));
  const packageMetadata = JSON.parse(
    await readFile(join(packageDirectory, "package.json"), "utf8"),
  );
  const dependencyRange = cmsPackage.dependencies[packageName];
  if (!packageMetadata.version) {
    throw new Error(`Could not verify the installed package ${packageName}.`);
  }
  const expectedVersion = dependencyRange?.replace(/^\D/, "");
  if (expectedVersion && packageMetadata.version !== expectedVersion) {
    throw new Error(
      `${packageName} must be ${expectedVersion}; found ${packageMetadata.version}.`,
    );
  }
  const versionedName = dependencyRange
    ? `${packageName}@${dependencyRange.replace(/^\D/, "")}`
    : packageName;
  const destination = join(
    vendorDirectory,
    ...versionedName.split("/"),
  );
  if (packageName === "pdfjs-dist") {
    for (const directory of [
      "build",
      "cmaps",
      "iccs",
      "standard_fonts",
      "wasm",
    ]) {
      await cp(
        join(packageDirectory, directory),
        join(destination, directory),
        { recursive: true },
      );
    }
  } else {
    await cp(packageDirectory, destination, { recursive: true });
  }
}

console.log(`Copied and self-hosted Sveltia CMS ${cmsPackage.version}.`);
