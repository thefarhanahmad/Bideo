import { useEffect } from "react";

const setMeta = (selector, attr, value) => {
  const el = document.querySelector(selector);
  if (el && value) el.setAttribute(attr, value);
};

/**
 * Keeps title, description, canonical, social tags and <html lang> in sync during
 * client-side navigation. The pre-rendered HTML already carries the same values
 * for the first page load (see scripts/prerender.mjs).
 */
export function useDocumentMeta({ title, description, url, lang = "en", noindex = false }) {
  useEffect(() => {
    if (title) document.title = title;
    setMeta('meta[name="description"]', "content", description);
    setMeta('meta[property="og:title"]', "content", title);
    setMeta('meta[property="og:description"]', "content", description);
    setMeta('meta[name="twitter:title"]', "content", title);
    setMeta('meta[name="twitter:description"]', "content", description);
    setMeta('link[rel="canonical"]', "href", url);
    setMeta('meta[property="og:url"]', "content", url);
    document.documentElement.setAttribute("lang", lang);

    let robots = document.querySelector('meta[name="robots"][data-dynamic]');
    if (noindex && !robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      robots.setAttribute("data-dynamic", "1");
      robots.setAttribute("content", "noindex");
      document.head.appendChild(robots);
    }
    return () => {
      document.documentElement.setAttribute("lang", "en");
      if (robots) robots.remove();
    };
  }, [title, description, url, lang, noindex]);
}
