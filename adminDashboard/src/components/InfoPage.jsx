import { useEffect } from "react";
import Navbar from "./landing/Navbar";
import Footer from "./landing/Footer";

/** Shared layout for static info/legal pages (Navbar + hero + content + Footer). */
const InfoPage = ({ title, subtitle, updated, children }) => {
  useEffect(() => {
    window.scrollTo(0, 0);
    if (title) {
      document.title = `${title} — Bideo`;
    }
    if (subtitle) {
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute("content", subtitle);
      }
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) {
        ogDesc.setAttribute("content", subtitle);
      }
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) {
        ogTitle.setAttribute("content", `${title} — Bideo`);
      }
    }
    const currentUrl = window.location.origin + window.location.pathname;
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      canonical.setAttribute("href", currentUrl);
    }
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) {
      ogUrl.setAttribute("content", currentUrl);
    }
  }, [title, subtitle]);

  return (
    <div className="min-h-screen bg-white font-sans text-ink">
      <Navbar />
      <header className="bg-gradient-to-b from-brand-50 to-white pt-32 pb-12">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {title}
          </h1>
          {subtitle && <p className="mt-3 text-muted">{subtitle}</p>}
          {updated && <p className="mt-2 text-sm text-muted">Last updated: {updated}</p>}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="space-y-9">{children}</div>
      </main>
      <Footer />
    </div>
  );
};

export const Section = ({ heading, children }) => (
  <section>
    {heading && <h2 className="font-display text-xl font-bold text-ink">{heading}</h2>}
    <div className="mt-3 space-y-3 leading-relaxed text-muted">{children}</div>
  </section>
);

export default InfoPage;
