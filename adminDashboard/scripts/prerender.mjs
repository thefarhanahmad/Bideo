// Post-build step: writes a static HTML file per public page with its own
// <title>, description, canonical, social tags and pre-rendered body content.
// The SPA shell (dist/index.html) is left untouched as the fallback for all other routes.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const ssrEntry = path.join(root, "dist-ssr", "entry-prerender.js");

const escapeAttr = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const replaceOnce = (html, pattern, replacement, label) => {
  const matches = html.match(new RegExp(pattern.source, pattern.flags.replace("g", "") + "g"));
  if (!matches || matches.length !== 1) throw new Error(`prerender: expected one ${label}, found ${matches ? matches.length : 0}`);
  return html.replace(pattern, () => replacement);
};

const pageJsonLd = (page, siteUrl) =>
  JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: page.title,
        description: page.description,
        url: `${siteUrl}${page.path}`,
        isPartOf: { "@type": "WebSite", name: "Bideo App", url: siteUrl },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl}/` },
          { "@type": "ListItem", position: 2, name: page.name, item: `${siteUrl}${page.path}` },
        ],
      },
    ],
  });

const withHead = (template, page, siteUrl) => {
  const url = `${siteUrl}${page.path}`;
  let html = template;
  html = replaceOnce(html, /<title>[\s\S]*?<\/title>/, `<title>${escapeAttr(page.title)}</title>`, "title");
  html = replaceOnce(html, /<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${escapeAttr(page.description)}" />`, "description");
  html = replaceOnce(html, /<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${url}" />`, "canonical");
  html = replaceOnce(html, /<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${escapeAttr(page.title)}" />`, "og:title");
  html = replaceOnce(html, /<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${escapeAttr(page.description)}" />`, "og:description");
  html = replaceOnce(html, /<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${url}" />`, "og:url");
  html = replaceOnce(html, /<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${escapeAttr(page.title)}" />`, "twitter:title");
  html = replaceOnce(html, /<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${escapeAttr(page.description)}" />`, "twitter:description");
  // Home-only structured data (app, FAQ) is replaced by this page's own structured data.
  const jsonLd = page.jsonLd ? JSON.stringify(page.jsonLd) : pageJsonLd(page, siteUrl);
  html = replaceOnce(
    html,
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
    `<script type="application/ld+json">${jsonLd.replace(/</g, "\\u003c")}</script>`,
    "JSON-LD block"
  );
  if (page.ogType) {
    html = replaceOnce(html, /<meta property="og:type" content="[^"]*"\s*\/?>/, `<meta property="og:type" content="${page.ogType}" />`, "og:type");
  }
  if (page.lang && page.lang !== "en") {
    html = replaceOnce(html, /<html lang="en">/, `<html lang="${page.lang}">`, "html lang");
  }
  const extra = [
    ...(page.alternates || []).map((a) => `<link rel="alternate" hreflang="${a.hreflang}" href="${a.href}" />`),
    ...(page.articleMeta
      ? [
          `<meta property="article:published_time" content="${page.articleMeta.published}" />`,
          `<meta property="article:modified_time" content="${page.articleMeta.modified}" />`,
          `<meta property="article:section" content="${escapeAttr(page.articleMeta.section)}" />`,
        ]
      : []),
  ];
  if (extra.length) html = replaceOnce(html, /<\/head>/, `    ${extra.join("\n    ")}\n  </head>`, "</head>");
  return html;
};

const withBody = (html, appHtml) =>
  replaceOnce(html, /<!--app-html-start-->[\s\S]*?<!--app-html-end-->/, appHtml, "app-html markers");

const main = async () => {
  const template = fs.readFileSync(path.join(dist, "index.html"), "utf8");
  const { render, getPrerenderPages, extraFiles, SITE_URL } = await import(pathToFileURL(ssrEntry).href);

  for (const page of getPrerenderPages()) {
    const appHtml = render(page.element, page.path);
    const head = page.path === "/" ? template : withHead(template, page, SITE_URL);
    const html = withBody(head, appHtml);
    const out = page.file ? path.join(dist, page.file) : path.join(dist, page.path.slice(1), "index.html");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, html);
    console.log(`prerendered ${page.path} -> ${path.relative(dist, out)} (${appHtml.length} chars of HTML)`);
  }
  for (const [file, content] of Object.entries(extraFiles())) {
    const out = path.join(dist, file);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, content);
    console.log(`wrote ${file} (${content.length} bytes)`);
  }
  fs.rmSync(path.join(root, "dist-ssr"), { recursive: true, force: true });
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
