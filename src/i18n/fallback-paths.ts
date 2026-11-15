import { getCollection } from "astro:content";
import { getStaticPagePaths } from "./static-paths.js";
import { isProductionLaunchGateActive } from "../../scripts/launch-gate.js";

export async function getFallbackPagePaths() {
  const [staticPaths, programs, reports, albums, news] = await Promise.all([
    getStaticPagePaths(),
    getCollection("programs"),
    getCollection("reports"),
    getCollection("albums", ({ data }) => data.published),
    getCollection("news", ({ data }) => !data.draft),
  ]);

  const paths = [
    ...new Set([
      ...staticPaths,
      ...programs.map((entry) => `programs/${entry.id}`),
      ...reports.map((entry) => `transparency/reports/${entry.id}`),
      ...albums.map((entry) => `gallery/${entry.id}`),
      ...news.map((entry) => `news/${entry.id}`),
      "legal/privacy",
      "legal/terms",
      "legal/donation-policy",
    ]),
  ];
  return isProductionLaunchGateActive()
    ? paths.filter((path) => path !== "design-system")
    : paths;
}
