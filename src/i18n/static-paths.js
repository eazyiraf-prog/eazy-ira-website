import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

export async function getStaticPagePaths(
  directory = resolve(process.cwd(), "src", "pages"),
  parent = "",
) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];

  for (const entry of entries) {
    if (entry.name.startsWith("[") || entry.name.startsWith(".")) continue;
    const relative = parent ? `${parent}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      paths.push(
        ...(await getStaticPagePaths(
          resolve(directory, entry.name),
          relative,
        )),
      );
    } else if (entry.name.endsWith(".astro")) {
      const path = relative.replace(/\.astro$/, "").replace(/\/index$/, "");
      if (
        path &&
        path !== "index" &&
        path !== "search" &&
        path !== "404" &&
        path !== "about" &&
        path !== "donate" &&
        path !== "legal/privacy" &&
        path !== "legal/terms" &&
        path !== "legal/donation-policy"
      ) {
        paths.push(path);
      }
    }
  }

  return paths;
}
