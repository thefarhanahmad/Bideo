import { Link, useParams } from "react-router-dom";
import { BlogShell, PostCard, Breadcrumbs, AppCta, CategoryCover } from "../../components/blog/BlogUi";
import { CATEGORIES, getPostsByCategory } from "../../lib/blog";
import { useDocumentMeta } from "../../hooks/useDocumentMeta";
import { categoryMeta } from "../../seo/blogMeta";

const BlogCategory = ({ category: categoryProp }) => {
  const params = useParams();
  const category = categoryProp || params.category;
  const cfg = CATEGORIES[category];
  const meta = cfg ? categoryMeta(category) : null;
  useDocumentMeta({
    title: meta ? meta.title : "Topic not found — Bideo Blog",
    description: meta ? meta.description : "This blog topic does not exist.",
    url: meta ? meta.url : "https://bideo.in/blog",
    noindex: !cfg,
  });

  if (!cfg) {
    return (
      <BlogShell>
        <main className="mx-auto max-w-3xl px-4 pt-36 pb-24 text-center">
          <h1 className="font-display text-3xl font-extrabold text-ink">Topic not found</h1>
          <Link to="/blog" className="mt-6 inline-block font-semibold text-brand hover:underline">← Back to the blog</Link>
        </main>
      </BlogShell>
    );
  }

  const posts = getPostsByCategory(category, "en");
  return (
    <BlogShell>
      <header className="bg-gradient-to-b from-brand-50 to-white pt-28 pb-10 sm:pt-32">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 text-center sm:px-6 md:flex-row md:text-left lg:px-8">
          <CategoryCover category={category} className="h-24 w-24 shrink-0 rounded-3xl shadow-card" />
          <div className="min-w-0">
            <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Blog", to: "/blog" }, { label: cfg.en }]} />
            <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{cfg.en}</h1>
            <p className="mt-2 text-muted">{cfg.description}</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
        <div className="mt-12 flex flex-wrap justify-center gap-2">
          {Object.entries(CATEGORIES)
            .filter(([key]) => key !== category)
            .map(([key, c]) => (
              <Link key={key} to={`/blog/category/${key}`} className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink/70 hover:text-brand">
                {c.icon} {c.en}
              </Link>
            ))}
        </div>
        <div className="mt-14">
          <AppCta />
        </div>
      </main>
    </BlogShell>
  );
};

export default BlogCategory;
