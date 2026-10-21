import { Marked } from "marked";

// Blog articles live in src/content/blog/<lang>/<slug>.md as:
//   ---
//   { "title": "...", "description": "...", "category": "earning", ... }
//   ---
//   Markdown body
// Everything is bundled at build time (no API calls), so pages pre-render and load instantly.

export const BLOG_LANGS = {
  en: { label: "English", index: "/blog", htmlLang: "en", locale: "en-IN" },
  hi: { label: "हिन्दी", index: "/blog/hi", htmlLang: "hi", locale: "hi-IN" },
};

export const CATEGORIES = {
  "getting-started": {
    en: "Getting Started",
    hi: "शुरुआत करें",
    description: "What Bideo is, how to install it and set up your channel.",
    icon: "🚀",
    tone: "from-orange-500 to-amber-400",
  },
  creators: {
    en: "Grow as a Creator",
    hi: "क्रिएटर बनें",
    description: "Ideas, filming tips and strategies to grow your audience on Bideo.",
    icon: "🎬",
    tone: "from-fuchsia-500 to-orange-400",
  },
  earning: {
    en: "Earn Money",
    hi: "पैसे कमाएँ",
    description: "Monetization, coins, boosts, the verified badge and payouts explained.",
    icon: "💰",
    tone: "from-emerald-500 to-lime-400",
  },
  features: {
    en: "App Features",
    hi: "ऐप फीचर्स",
    description: "Stories, posts, chat, playlists, the leaderboard and more.",
    icon: "✨",
    tone: "from-sky-500 to-indigo-400",
  },
  safety: {
    en: "Safety & Account",
    hi: "सुरक्षा और अकाउंट",
    description: "Staying safe, reporting content, copyright rules and account settings.",
    icon: "🛡️",
    tone: "from-slate-600 to-slate-400",
  },
};

// Card icon per topic, matched against the slug (first match wins).
const TOPIC_ICONS = [
  [/withdraw|nikale/, "🏦"],
  [/coins/, "🪙"],
  [/boost/, "🚀"],
  [/verified|badge/, "✅"],
  [/monetization/, "📋"],
  [/viral/, "🔥"],
  [/followers/, "👥"],
  [/ideas/, "💡"],
  [/best-time/, "⏰"],
  [/shoot/, "📱"],
  [/hashtags|titles/, "#️⃣"],
  [/regional/, "🗣️"],
  [/download/, "📲"],
  [/create-bideo-account/, "👤"],
  [/features/, "✨"],
  [/start-a-video-channel/, "🎬"],
  [/what-is|kya-hai/, "▶️"],
  [/safe/, "🛡️"],
  [/delete/, "🗑️"],
  [/report/, "🚩"],
  [/guidelines|copyright/, "📜"],
  [/chat/, "💬"],
  [/stories/, "⭕"],
  [/playlists/, "📚"],
  [/leaderboard/, "🏆"],
  [/earn|kamaye/, "💰"],
];
const iconFor = (slug, category) => (TOPIC_ICONS.find(([re]) => re.test(slug)) || [null, CATEGORIES[category].icon])[1];

const FRONT_MATTER = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;

export const slugifyHeading = (text) =>
  String(text)
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/g, "")
    .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");

const countWords = (text) => (text.match(/[\p{L}\p{N}]+/gu) || []).length;

const parsePost = (path, raw) => {
  const match = raw.match(FRONT_MATTER);
  if (!match) throw new Error(`Blog post ${path} is missing its front matter`);
  const meta = JSON.parse(match[1]);
  const lang = path.includes("/hi/") ? "hi" : "en";
  const slug = path.split("/").pop().replace(/\.md$/, "");
  const body = match[2].trim();
  const headings = [...body.matchAll(/^##\s+(.+)$/gm)].map((m) => ({
    text: m[1].replace(/\*\*/g, "").trim(),
    id: slugifyHeading(m[1].replace(/\*\*/g, "")),
  }));
  if (!CATEGORIES[meta.category]) throw new Error(`Blog post ${slug} has unknown category "${meta.category}"`);
  return {
    slug,
    lang,
    title: meta.title,
    description: meta.description,
    category: meta.category,
    date: meta.date,
    updated: meta.updated || meta.date,
    keywords: meta.keywords || [],
    translation: meta.translation || null,
    featured: Boolean(meta.featured),
    faq: meta.faq || [],
    body,
    headings,
    readingMinutes: Math.max(2, Math.round(countWords(body) / 200)),
    icon: iconFor(slug, meta.category),
  };
};

const files = import.meta.glob("../content/blog/**/*.md", { query: "?raw", import: "default", eager: true });

const ALL_POSTS = Object.entries(files)
  .map(([path, raw]) => parsePost(path, raw))
  .sort((a, b) => (b.date === a.date ? a.title.localeCompare(b.title) : b.date.localeCompare(a.date)));

const BY_SLUG = new Map(ALL_POSTS.map((p) => [p.slug, p]));
if (BY_SLUG.size !== ALL_POSTS.length) throw new Error("Duplicate blog slugs found");

export const getAllPosts = () => ALL_POSTS;
export const getPosts = (lang = "en") => ALL_POSTS.filter((p) => p.lang === lang);
export const getPost = (slug) => BY_SLUG.get(slug) || null;
export const getPostsByCategory = (category, lang = "en") => getPosts(lang).filter((p) => p.category === category);
export const getTranslation = (post) => (post && post.translation ? getPost(post.translation) : null);

/** Same-category posts first, then the newest others; never the post itself. */
export const getRelatedPosts = (post, limit = 3) => {
  const pool = getPosts(post.lang).filter((p) => p.slug !== post.slug);
  const same = pool.filter((p) => p.category === post.category);
  const rest = pool.filter((p) => p.category !== post.category);
  return [...same, ...rest].slice(0, limit);
};

export const categoryLabel = (category, lang = "en") => (CATEGORIES[category] ? CATEGORIES[category][lang] : category);

export const formatPostDate = (iso, lang = "en") =>
  new Intl.DateTimeFormat(BLOG_LANGS[lang].locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));

const markdown = new Marked({ gfm: true });
markdown.use({
  renderer: {
    heading(text, level, raw) {
      if (level === 2 || level === 3) {
        const id = slugifyHeading(raw.replace(/\*\*/g, ""));
        return `<h${level} id="${id}">${text}</h${level}>\n`;
      }
      return `<h${level}>${text}</h${level}>\n`;
    },
    link(href, title, text) {
      const external = /^https?:\/\//.test(href) && !href.startsWith("https://bideo.in");
      const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : "";
      const t = title ? ` title="${title}"` : "";
      return `<a href="${href}"${t}${attrs}>${text}</a>`;
    },
    table(header, body) {
      return `<div class="blog-table"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>\n`;
    },
  },
});

const htmlCache = new Map();
export const renderPostHtml = (post) => {
  if (!htmlCache.has(post.slug)) htmlCache.set(post.slug, markdown.parse(post.body));
  return htmlCache.get(post.slug);
};
