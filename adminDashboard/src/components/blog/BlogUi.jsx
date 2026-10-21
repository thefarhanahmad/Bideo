import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../landing/Navbar";
import Footer from "../landing/Footer";
import DownloadButton from "../DownloadButton";
import { CATEGORIES, BLOG_LANGS, categoryLabel, formatPostDate } from "../../lib/blog";

const TEXT = {
  en: {
    minRead: "min read",
    cta: "Watch, create and earn on Bideo",
    ctaBody: "Download the free Bideo App on Google Play and start watching shorts and videos from Indian creators — or upload your own.",
    download: "Download Bideo App",
    faq: "Frequently asked questions",
    share: "Share this guide",
    copy: "Copy link",
    copied: "Copied!",
    contents: "On this page",
    home: "Home",
    blog: "Blog",
  },
  hi: {
    minRead: "मिनट पढ़ें",
    cta: "Bideo पर देखें, बनाएँ और कमाएँ",
    ctaBody: "Google Play से मुफ़्त Bideo App डाउनलोड करें और भारतीय क्रिएटर्स के शॉर्ट्स और वीडियो देखें — या अपने वीडियो अपलोड करें।",
    download: "Bideo App डाउनलोड करें",
    faq: "अक्सर पूछे जाने वाले सवाल",
    share: "यह गाइड शेयर करें",
    copy: "लिंक कॉपी करें",
    copied: "कॉपी हो गया!",
    contents: "इस पेज पर",
    home: "होम",
    blog: "ब्लॉग",
  },
};
export const t = (lang, key) => (TEXT[lang] || TEXT.en)[key];

/** Navbar + content + footer, same frame as the other public pages. */
export const BlogShell = ({ children }) => (
  <div className="min-h-screen bg-white font-sans text-ink">
    <Navbar />
    {children}
    <Footer />
  </div>
);

export const CategoryCover = ({ category, icon, className = "", size = "md" }) => {
  const c = CATEGORIES[category];
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${c.tone} ${className}`} aria-hidden="true">
      <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/15" />
      <div className="absolute -bottom-10 -left-8 h-36 w-36 rounded-full bg-black/10" />
      <span className={`absolute inset-0 grid place-items-center drop-shadow-sm ${size === "lg" ? "text-6xl sm:text-7xl" : "text-5xl"}`}>{icon || c.icon}</span>
    </div>
  );
};

export const PostCard = ({ post, featured = false }) => (
  <article
    className={`group relative flex overflow-hidden rounded-2xl border border-line bg-white shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${
      featured ? "flex-col md:flex-row" : "flex-col"
    }`}
  >
    <CategoryCover category={post.category} icon={post.icon} size={featured ? "lg" : "md"} className={featured ? "aspect-[16/9] md:aspect-auto md:w-2/5 shrink-0" : "aspect-[16/9]"} />
    <div className={`flex flex-1 flex-col p-5 ${featured ? "md:p-8" : ""}`}>
      <span className="text-xs font-semibold uppercase tracking-wider text-brand">{categoryLabel(post.category, post.lang)}</span>
      <h3 className={`mt-2 font-display font-bold leading-snug text-ink group-hover:text-brand ${featured ? "text-xl sm:text-2xl" : "text-lg line-clamp-2"}`}>
        <Link to={`/blog/${post.slug}`} className="after:absolute after:inset-0">
          {post.title}
        </Link>
      </h3>
      <p className={`mt-2 text-sm leading-relaxed text-muted ${featured ? "line-clamp-4" : "line-clamp-3"}`}>{post.description}</p>
      <p className="mt-auto pt-4 text-xs text-muted">
        {formatPostDate(post.date, post.lang)} · {post.readingMinutes} {t(post.lang, "minRead")}
      </p>
    </div>
  </article>
);

export const Breadcrumbs = ({ items }) => (
  <nav aria-label="Breadcrumb" className="text-xs text-muted">
    <ol className="flex flex-wrap items-center gap-1.5">
      {items.map((item, i) => (
        <li key={item.label} className="flex items-center gap-1.5 min-w-0">
          {i > 0 && <span aria-hidden="true">/</span>}
          {item.to ? (
            <Link to={item.to} className="hover:text-brand truncate">{item.label}</Link>
          ) : (
            <span className="truncate text-ink/70" aria-current="page">{item.label}</span>
          )}
        </li>
      ))}
    </ol>
  </nav>
);

export const LangSwitch = ({ current, links }) => (
  <div className="inline-flex rounded-full border border-line bg-white p-1 text-sm shadow-sm" role="navigation" aria-label="Language">
    {Object.entries(BLOG_LANGS).map(([code, cfg]) => {
      const active = code === current;
      const to = links[code];
      return active || !to ? (
        <span
          key={code}
          className={`rounded-full px-4 py-1.5 font-semibold ${active ? "bg-brand text-white" : "text-muted/50"}`}
          aria-current={active ? "true" : undefined}
        >
          {cfg.label}
        </span>
      ) : (
        <Link key={code} to={to} hrefLang={cfg.htmlLang} className="rounded-full px-4 py-1.5 font-semibold text-ink/70 hover:text-brand">
          {cfg.label}
        </Link>
      );
    })}
  </div>
);

export const AppCta = ({ lang = "en", compact = false }) => (
  <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand to-brand-darker text-white shadow-brand ${compact ? "p-5" : "p-6 sm:p-10"}`}>
    <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" aria-hidden="true" />
    <div className="relative">
      <p className={`font-display font-extrabold ${compact ? "text-lg" : "text-2xl sm:text-3xl"}`}>{t(lang, "cta")}</p>
      <p className={`mt-2 text-white/85 ${compact ? "text-sm" : "max-w-2xl"}`}>{t(lang, "ctaBody")}</p>
      <DownloadButton
        size={compact ? "sm" : "md"}
        label={t(lang, "download")}
        className="mt-5 bg-white !text-brand hover:!bg-brand-50 shadow-none"
      />
    </div>
  </div>
);

export const FaqList = ({ faq, lang }) => (
  <section aria-labelledby="faq-heading" className="mt-12">
    <h2 id="faq-heading" className="font-display text-2xl font-bold text-ink">{t(lang, "faq")}</h2>
    <div className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
      {faq.map((item, i) => (
        <details key={item.q} className="group" open={i === 0}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold text-ink hover:bg-surface/60">
            <span>{item.q}</span>
            <span className="shrink-0 text-brand transition-transform group-open:rotate-45" aria-hidden="true">+</span>
          </summary>
          <p className="px-5 pb-5 leading-relaxed text-muted">{item.a}</p>
        </details>
      ))}
    </div>
  </section>
);

export const ShareBar = ({ url, title, lang }) => {
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent;
  const links = [
    { name: "WhatsApp", href: `https://wa.me/?text=${enc(`${title} ${url}`)}` },
    { name: "X", href: `https://twitter.com/intent/tweet?text=${enc(title)}&url=${enc(url)}` },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
  ];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm font-semibold text-ink">{t(lang, "share")}:</span>
      {links.map((l) => (
        <a
          key={l.name}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-line bg-white px-3.5 py-1.5 text-xs font-semibold text-ink/80 hover:border-brand hover:text-brand"
        >
          {l.name}
        </a>
      ))}
      <button type="button" onClick={copy} className="rounded-full border border-line bg-white px-3.5 py-1.5 text-xs font-semibold text-ink/80 hover:border-brand hover:text-brand">
        {copied ? t(lang, "copied") : t(lang, "copy")}
      </button>
    </div>
  );
};

export const Toc = ({ headings, lang }) =>
  headings.length < 2 ? null : (
    <nav aria-label={t(lang, "contents")} className="rounded-2xl border border-line bg-surface/50 p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-muted">{t(lang, "contents")}</p>
      <ol className="mt-3 space-y-2 text-sm">
        {headings.map((h) => (
          <li key={h.id}>
            <a href={`#${h.id}`} className="text-ink/75 hover:text-brand">{h.text}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
