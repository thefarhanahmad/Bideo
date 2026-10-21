// Titles, URLs, hreflang links and structured data for blog pages.
// Shared by the React pages (client-side meta) and scripts/prerender.mjs (static HTML).
import { CATEGORIES, getAllPosts, getTranslation } from "../lib/blog";
import { SITE_URL } from "./publicPages";

const ORG = {
  "@type": "Organization",
  name: "Bideo",
  url: SITE_URL,
  logo: { "@type": "ImageObject", url: `${SITE_URL}/android-chrome-512x512.png` },
};

export const BLOG_INDEX_META = {
  en: {
    path: "/blog",
    url: `${SITE_URL}/blog`,
    title: "Bideo Blog — Guides for the Bideo App, Creators & Earning",
    description:
      "Simple guides to the Bideo App: how to download it, grow your channel, go viral with short videos, earn coins and money, withdraw payouts and stay safe.",
  },
  hi: {
    path: "/blog/hi",
    url: `${SITE_URL}/blog/hi`,
    title: "Bideo ब्लॉग — Bideo App, क्रिएटर्स और कमाई की गाइड",
    description:
      "Bideo App की आसान हिंदी गाइड: ऐप डाउनलोड करें, चैनल बढ़ाएँ, शॉर्ट वीडियो वायरल करें, कॉइन्स और पैसे कमाएँ और पेमेंट निकालें।",
  },
};

export const categoryMeta = (category) => {
  const c = CATEGORIES[category];
  return {
    path: `/blog/category/${category}`,
    url: `${SITE_URL}/blog/category/${category}`,
    title: `${c.en} — Bideo Blog`,
    description: `${c.description} Step-by-step guides from the Bideo team.`,
  };
};

export const postMeta = (post) => ({
  path: `/blog/${post.slug}`,
  url: `${SITE_URL}/blog/${post.slug}`,
  title: `${post.title} | Bideo Blog`,
  description: post.description,
});

const breadcrumb = (items) => ({
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: item.url })),
});

/** hreflang alternates for a post (itself + its translation, x-default = English). */
export const postAlternates = (post) => {
  const other = getTranslation(post);
  if (!other) return [];
  const versions = [post, other];
  const links = versions.map((p) => ({ hreflang: p.lang, href: `${SITE_URL}/blog/${p.slug}` }));
  const en = versions.find((p) => p.lang === "en");
  if (en) links.push({ hreflang: "x-default", href: `${SITE_URL}/blog/${en.slug}` });
  return links.length > 1 ? links : [];
};

export const indexAlternates = () => [
  { hreflang: "en", href: BLOG_INDEX_META.en.url },
  { hreflang: "hi", href: BLOG_INDEX_META.hi.url },
  { hreflang: "x-default", href: BLOG_INDEX_META.en.url },
];

export const postJsonLd = (post) => {
  const meta = postMeta(post);
  const blogHome = post.lang === "hi" ? BLOG_INDEX_META.hi : BLOG_INDEX_META.en;
  const graph = [
    {
      "@type": "BlogPosting",
      headline: post.title,
      description: post.description,
      inLanguage: post.lang === "hi" ? "hi-IN" : "en-IN",
      datePublished: post.date,
      dateModified: post.updated,
      author: ORG,
      publisher: ORG,
      mainEntityOfPage: { "@type": "WebPage", "@id": meta.url },
      url: meta.url,
      image: `${SITE_URL}/android-chrome-512x512.png`,
      keywords: post.keywords.join(", "),
      articleSection: CATEGORIES[post.category][post.lang],
    },
    breadcrumb([
      { name: "Home", url: `${SITE_URL}/` },
      { name: post.lang === "hi" ? "ब्लॉग" : "Blog", url: blogHome.url },
      { name: post.title, url: meta.url },
    ]),
  ];
  // FAQ structured data only mirrors the FAQ that is visible on the page.
  if (post.faq.length) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: post.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
};

export const indexJsonLd = (lang, posts) => {
  const meta = BLOG_INDEX_META[lang];
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Blog",
        name: meta.title,
        description: meta.description,
        url: meta.url,
        inLanguage: lang === "hi" ? "hi-IN" : "en-IN",
        publisher: ORG,
        blogPost: posts.map((p) => ({ "@type": "BlogPosting", headline: p.title, url: `${SITE_URL}/blog/${p.slug}`, datePublished: p.date })),
      },
      breadcrumb([
        { name: "Home", url: `${SITE_URL}/` },
        { name: lang === "hi" ? "ब्लॉग" : "Blog", url: meta.url },
      ]),
    ],
  };
};

export const categoryJsonLd = (category, posts) => {
  const meta = categoryMeta(category);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: meta.title,
        description: meta.description,
        url: meta.url,
        hasPart: posts.map((p) => ({ "@type": "BlogPosting", headline: p.title, url: `${SITE_URL}/blog/${p.slug}` })),
      },
      breadcrumb([
        { name: "Home", url: `${SITE_URL}/` },
        { name: "Blog", url: BLOG_INDEX_META.en.url },
        { name: CATEGORIES[category].en, url: meta.url },
      ]),
    ],
  };
};

/** Static blog sitemap (written by the pre-render step; listed in the backend sitemap index). */
export const blogSitemapXml = () => {
  const posts = getAllPosts();
  const latest = posts.reduce((m, p) => (p.updated > m ? p.updated : m), "1970-01-01");
  const alt = (links) => links.map((l) => `\n    <xhtml:link rel="alternate" hreflang="${l.hreflang}" href="${l.href}"/>`).join("");
  const urls = [
    { loc: BLOG_INDEX_META.en.url, lastmod: latest, links: indexAlternates() },
    { loc: BLOG_INDEX_META.hi.url, lastmod: latest, links: indexAlternates() },
    ...Object.keys(CATEGORIES)
      .filter((c) => posts.some((p) => p.category === c && p.lang === "en"))
      .map((c) => ({ loc: categoryMeta(c).url, lastmod: latest, links: [] })),
    ...posts.map((p) => ({ loc: postMeta(p).url, lastmod: p.updated, links: postAlternates(p) })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls
    .map((u) => `\n  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>${alt(u.links)}\n  </url>`)
    .join("")}
</urlset>
`;
};

/** RSS feed of the newest posts (both languages). */
export const blogRssXml = () => {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const items = getAllPosts()
    .slice(0, 50)
    .map(
      (p) => `
    <item>
      <title>${esc(p.title)}</title>
      <link>${SITE_URL}/blog/${p.slug}</link>
      <guid>${SITE_URL}/blog/${p.slug}</guid>
      <description>${esc(p.description)}</description>
      <pubDate>${new Date(p.date).toUTCString()}</pubDate>
    </item>`
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Bideo Blog</title>
    <link>${SITE_URL}/blog</link>
    <description>${esc(BLOG_INDEX_META.en.description)}</description>
    <language>en-in</language>${items}
  </channel>
</rss>
`;
};
