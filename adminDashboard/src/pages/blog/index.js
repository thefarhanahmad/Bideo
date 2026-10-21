import { lazyWithPreload } from "../../lib/lazyWithPreload";

// One chunk for the whole blog: only downloaded on /blog pages.
const loadBlog = () => import("./BlogPages");

export const BlogIndex = lazyWithPreload(() => loadBlog().then((m) => ({ default: m.BlogIndex })));
export const BlogPost = lazyWithPreload(() => loadBlog().then((m) => ({ default: m.BlogPost })));
export const BlogCategory = lazyWithPreload(() => loadBlog().then((m) => ({ default: m.BlogCategory })));

export const isBlogPath = (pathname) => pathname === "/blog" || pathname.startsWith("/blog/");

export const preloadBlog = () => Promise.all([BlogIndex.preload(), BlogPost.preload(), BlogCategory.preload()]);
