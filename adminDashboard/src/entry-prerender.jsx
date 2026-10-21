// Build-time only (vite build --ssr): renders public pages and the blog to HTML strings.
// Not loaded in the browser.
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import Landing from "./pages/Landing";
import About from "./pages/About";
import Creators from "./pages/Creators";
import FaqPage from "./pages/FaqPage";
import Contact from "./pages/Contact";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Guidelines from "./pages/Guidelines";
import CopyrightPolicy from "./pages/CopyrightPolicy";
import ModerationPolicy from "./pages/ModerationPolicy";
import CookiePolicy from "./pages/CookiePolicy";
import AccountDeletion from "./pages/AccountDeletion";
import ChildSafety from "./pages/ChildSafety";
import RefundPolicy from "./pages/RefundPolicy";
import { BlogIndex, BlogPost, BlogCategory } from "./pages/blog/BlogPages";
import { PUBLIC_PAGES, SITE_URL } from "./seo/publicPages";
import { CATEGORIES, getAllPosts, getPosts, getPostsByCategory } from "./lib/blog";
import {
  BLOG_INDEX_META,
  blogRssXml,
  blogSitemapXml,
  categoryJsonLd,
  categoryMeta,
  indexAlternates,
  indexJsonLd,
  postAlternates,
  postJsonLd,
  postMeta,
} from "./seo/blogMeta";

export { SITE_URL };

const STATIC_COMPONENTS = {
  "/": Landing,
  "/about": About,
  "/creators": Creators,
  "/for-creators": Creators,
  "/faq": FaqPage,
  "/contact": Contact,
  "/terms": Terms,
  "/privacy": Privacy,
  "/guidelines": Guidelines,
  "/copyright": CopyrightPolicy,
  "/moderation": ModerationPolicy,
  "/cookies": CookiePolicy,
  "/account-deletion": AccountDeletion,
  "/child-safety": ChildSafety,
  "/refunds": RefundPolicy,
};

const blogPages = () => [
  ...["en", "hi"].map((lang) => ({
    ...BLOG_INDEX_META[lang],
    name: "Blog",
    lang,
    alternates: indexAlternates(),
    jsonLd: indexJsonLd(lang, getPosts(lang)),
    element: <BlogIndex lang={lang} />,
  })),
  ...Object.keys(CATEGORIES)
    .filter((c) => getPostsByCategory(c, "en").length > 0)
    .map((c) => ({
      ...categoryMeta(c),
      name: CATEGORIES[c].en,
      lang: "en",
      jsonLd: categoryJsonLd(c, getPostsByCategory(c, "en")),
      element: <BlogCategory category={c} />,
    })),
  ...getAllPosts().map((post) => ({
    ...postMeta(post),
    name: post.title,
    lang: post.lang,
    ogType: "article",
    alternates: postAlternates(post),
    articleMeta: { published: post.date, modified: post.updated, section: CATEGORIES[post.category].en },
    jsonLd: postJsonLd(post),
    element: <BlogPost slug={post.slug} />,
  })),
];

/** Every page to pre-render: { path, file?, title, description, lang?, jsonLd?, ..., element } */
export function getPrerenderPages() {
  const staticPages = PUBLIC_PAGES.map((page) => {
    const Page = STATIC_COMPONENTS[page.path];
    if (!Page) throw new Error(`No pre-render component for ${page.path}`);
    return { ...page, element: <Page /> };
  });
  return [...staticPages, ...blogPages()];
}

export function render(element, path) {
  return renderToString(<StaticRouter location={path}>{element}</StaticRouter>);
}

/** Extra static files written next to the pages. */
export function extraFiles() {
  return {
    "blog-sitemap.xml": blogSitemapXml(),
    "blog/rss.xml": blogRssXml(),
  };
}
