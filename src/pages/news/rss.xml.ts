import { getCollection } from "astro:content";
import type { APIRoute } from "astro";

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

export const GET: APIRoute = async ({ site }) => {
  const posts = (await getCollection("news", ({ data }) => !data.draft)).sort(
    (first, second) => second.data.date.getTime() - first.data.date.getTime(),
  );
  const linkFor = (path: string) =>
    site ? new URL(path, site).href : path;
  const feedUrl = linkFor("/news/rss.xml");
  const homeUrl = linkFor("/news");
  const items = posts
    .map((post) => {
      const postUrl = linkFor(`/news/${post.id}`);
      return `    <item>
      <title>${escapeXml(post.data.title)}</title>
      <link>${escapeXml(postUrl)}</link>
      <guid isPermaLink="${site ? "true" : "false"}">${escapeXml(postUrl)}</guid>
      <description>${escapeXml(post.data.summary)}</description>
      <category>${escapeXml(post.data.category)}</category>
      <author>${escapeXml(post.data.author)}</author>
      <pubDate>${post.data.date.toUTCString()}</pubDate>
    </item>`;
    })
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>EAZY-IRA Charity Foundation — News</title>
    <link>${escapeXml(homeUrl)}</link>
    <description>News and updates from EAZY-IRA Charity Foundation.</description>
    <language>en</language>
    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
};
