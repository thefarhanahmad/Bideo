import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BlogShell, PostCard, LangSwitch, AppCta } from "../../components/blog/BlogUi";
import { CATEGORIES, getPosts } from "../../lib/blog";
import { useDocumentMeta } from "../../hooks/useDocumentMeta";
import { BLOG_INDEX_META } from "../../seo/blogMeta";

const COPY = {
  en: {
    eyebrow: "Bideo Blog",
    heading: "Guides for Bideo creators and viewers",
    sub: "How to use the Bideo App, grow your channel, earn money from short videos and stay safe — explained simply.",
    search: "Search guides… (e.g. earn money, coins, viral)",
    all: "All",
    none: "No guides match your search.",
    latest: "All guides",
  },
  hi: {
    eyebrow: "Bideo ब्लॉग",
    heading: "Bideo क्रिएटर्स और दर्शकों के लिए गाइड",
    sub: "Bideo App कैसे इस्तेमाल करें, चैनल कैसे बढ़ाएँ, शॉर्ट वीडियो से पैसे कैसे कमाएँ — आसान भाषा में।",
    search: "गाइड खोजें… (जैसे पैसे, कॉइन्स, वायरल)",
    all: "सभी",
    none: "आपकी खोज से कोई गाइड नहीं मिली।",
    latest: "सभी गाइड",
  },
};

const BlogIndex = ({ lang = "en" }) => {
  const c = COPY[lang];
  const meta = BLOG_INDEX_META[lang];
  useDocumentMeta({ title: meta.title, description: meta.description, url: meta.url, lang });

  const posts = getPosts(lang);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter(
      (p) =>
        (!category || p.category === category) &&
        (!q || [p.title, p.description, ...p.keywords].some((s) => s.toLowerCase().includes(q)))
    );
  }, [posts, query, category]);

  const featured = !query && !category ? posts.find((p) => p.featured) : null;
  const grid = featured ? visible.filter((p) => p.slug !== featured.slug) : visible;
  const usedCategories = Object.keys(CATEGORIES).filter((k) => posts.some((p) => p.category === k));

  return (
    <BlogShell>
      <header className="bg-gradient-to-b from-brand-50 to-white pt-28 pb-10 sm:pt-32">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand">{c.eyebrow}</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-5xl">{c.heading}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted sm:text-lg">{c.sub}</p>
          <div className="mt-6 flex justify-center">
            <LangSwitch current={lang} links={{ en: "/blog", hi: "/blog/hi" }} />
          </div>
          <div className="mx-auto mt-6 max-w-xl">
            <label className="sr-only" htmlFor="blog-search">{c.search}</label>
            <input
              id="blog-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={c.search}
              className="w-full rounded-full border border-line bg-white px-5 py-3 text-sm text-ink shadow-sm outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          <div className="flex min-w-max gap-2 sm:min-w-0 sm:flex-wrap sm:justify-center">
            {["", ...usedCategories].map((key) => {
              const active = category === key;
              return (
                <button
                  key={key || "all"}
                  type="button"
                  onClick={() => setCategory(key)}
                  aria-pressed={active}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    active ? "bg-brand text-white shadow-sm" : "border border-line bg-white text-ink/70 hover:text-brand"
                  }`}
                >
                  {key ? `${CATEGORIES[key].icon} ${CATEGORIES[key][lang]}` : c.all}
                </button>
              );
            })}
          </div>
        </div>

        {featured && (
          <div className="mt-8">
            <PostCard post={featured} featured />
          </div>
        )}

        <h2 className="mt-12 font-display text-2xl font-bold text-ink">{c.latest}</h2>
        {grid.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-line p-10 text-center text-muted">{c.none}</p>
        ) : (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {grid.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        )}

        {lang === "en" && (
          <section className="mt-16">
            <h2 className="font-display text-2xl font-bold text-ink">Browse by topic</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {usedCategories.map((key) => (
                <Link
                  key={key}
                  to={`/blog/category/${key}`}
                  className="rounded-2xl border border-line bg-white p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-brand/40"
                >
                  <span className="text-2xl" aria-hidden="true">{CATEGORIES[key].icon}</span>
                  <p className="mt-2 font-display font-bold text-ink">{CATEGORIES[key].en}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{CATEGORIES[key].description}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="mt-16">
          <AppCta lang={lang} />
        </div>
      </main>
    </BlogShell>
  );
};

export default BlogIndex;
