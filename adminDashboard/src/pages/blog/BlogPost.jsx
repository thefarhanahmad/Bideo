import { useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BlogShell, PostCard, Breadcrumbs, AppCta, FaqList, ShareBar, Toc, LangSwitch, t } from "../../components/blog/BlogUi";
import { categoryLabel, formatPostDate, getPost, getRelatedPosts, getTranslation, renderPostHtml } from "../../lib/blog";
import { useDocumentMeta } from "../../hooks/useDocumentMeta";
import { postMeta } from "../../seo/blogMeta";

const NotFound = () => (
  <BlogShell>
    <main className="mx-auto max-w-3xl px-4 pt-36 pb-24 text-center">
      <h1 className="font-display text-3xl font-extrabold text-ink">Article not found</h1>
      <p className="mt-3 text-muted">This guide may have moved. Browse all guides instead.</p>
      <Link to="/blog" className="mt-6 inline-block font-semibold text-brand hover:underline">← Back to the blog</Link>
    </main>
  </BlogShell>
);

const BlogPost = ({ slug: slugProp }) => {
  const params = useParams();
  const navigate = useNavigate();
  const post = getPost(slugProp || params.slug);
  const meta = post ? postMeta(post) : null;
  useDocumentMeta({
    title: meta ? meta.title : "Article not found — Bideo Blog",
    description: meta ? meta.description : "This article does not exist.",
    url: meta ? meta.url : "https://bideo.in/blog",
    lang: post ? post.lang : "en",
    noindex: !post,
  });

  // Internal links inside the article navigate without a full page reload.
  const onArticleClick = useCallback(
    (e) => {
      const a = e.target.closest("a");
      if (!a || a.target === "_blank" || e.metaKey || e.ctrlKey) return;
      const href = a.getAttribute("href") || "";
      if (href.startsWith("/") && !href.startsWith("//")) {
        e.preventDefault();
        navigate(href);
        window.scrollTo(0, 0);
      }
    },
    [navigate]
  );

  if (!post) return <NotFound />;

  const lang = post.lang;
  const translation = getTranslation(post);
  const related = getRelatedPosts(post, 3);
  const blogHome = lang === "hi" ? "/blog/hi" : "/blog";

  return (
    <BlogShell>
      <article lang={lang}>
        <header className="bg-gradient-to-b from-brand-50 to-white pt-28 pb-8 sm:pt-32">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
            <Breadcrumbs
              items={[
                { label: t(lang, "home"), to: "/" },
                { label: t(lang, "blog"), to: blogHome },
                lang === "en" ? { label: categoryLabel(post.category, lang), to: `/blog/category/${post.category}` } : { label: categoryLabel(post.category, lang) },
              ]}
            />
            <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-brand">{categoryLabel(post.category, lang)}</p>
            <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-[2.6rem]">{post.title}</h1>
            <p className="mt-4 text-lg leading-relaxed text-muted">{post.description}</p>
            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
              <span className="font-semibold text-ink">Bideo Team</span>
              <span aria-hidden="true">·</span>
              <time dateTime={post.updated}>{formatPostDate(post.updated, lang)}</time>
              <span aria-hidden="true">·</span>
              <span>{post.readingMinutes} {t(lang, "minRead")}</span>
            </div>
            {translation && (
              <div className="mt-5">
                <LangSwitch current={lang} links={{ [lang]: null, [translation.lang]: `/blog/${translation.slug}` }} />
              </div>
            )}
            </div>
          </div>
        </header>

        <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:px-8">
          <div className="min-w-0">
            <div className="lg:hidden mb-8">
              <Toc headings={post.headings} lang={lang} />
            </div>
            <div className="blog-prose" onClick={onArticleClick} dangerouslySetInnerHTML={{ __html: renderPostHtml(post) }} />
            {post.faq.length > 0 && <FaqList faq={post.faq} lang={lang} />}
            <div className="mt-10 border-t border-line pt-6">
              <ShareBar url={meta.url} title={post.title} lang={lang} />
            </div>
            <div className="mt-10">
              <AppCta lang={lang} />
            </div>
          </div>
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-6">
              <Toc headings={post.headings} lang={lang} />
              <AppCta lang={lang} compact />
            </div>
          </aside>
        </div>
      </article>

      {related.length > 0 && (
        <section className="bg-surface/60 py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-2xl font-bold text-ink">{lang === "hi" ? "और पढ़ें" : "Keep reading"}</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <PostCard key={p.slug} post={p} />
              ))}
            </div>
          </div>
        </section>
      )}
    </BlogShell>
  );
};

export default BlogPost;
