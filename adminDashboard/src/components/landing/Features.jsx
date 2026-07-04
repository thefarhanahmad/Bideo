import {
  PlayIcon,
  ShortsIcon,
  UploadIcon,
  UsersIcon,
  ListIcon,
  ShieldIcon,
} from "../Icons";

const features = [
  {
    icon: PlayIcon,
    title: "Watch videos",
    desc: "Discover long-form videos in a smooth player designed for everyday mobile viewing.",
  },
  {
    icon: ShortsIcon,
    title: "Shorts feed",
    desc: "Browse vertical videos with familiar interactions, quick discovery, and simple sharing tools.",
  },
  {
    icon: UploadIcon,
    title: "Upload content",
    desc: "Publish videos and shorts with thumbnails, categories, and visibility controls.",
  },
  {
    icon: UsersIcon,
    title: "Build your channel",
    desc: "Create a profile, publish consistently, and connect with viewers who follow your work.",
  },
  {
    icon: ListIcon,
    title: "Playlists and history",
    desc: "Save videos into playlists, like useful content, and pick up where you left off.",
  },
  {
    icon: ShieldIcon,
    title: "Account controls",
    desc: "Sign in with Google or phone when you want to upload, comment, follow, or manage your profile.",
  },
];

const Features = () => (
  <section id="features" className="py-20 sm:py-28">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="reveal mx-auto max-w-2xl text-center">
        <span className="text-sm font-bold uppercase tracking-wider text-brand">
          Everything you need
        </span>
        <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          One app for watching and creating
        </h2>
        <p className="mt-4 text-lg text-muted">
          Bideo combines viewing, publishing, discovery, and safety tools in one mobile-first app.
        </p>
      </div>

      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => (
          <div
            key={f.title}
            className={`reveal reveal-delay-${(i % 3) + 1} group rounded-2xl border border-line bg-white p-7 shadow-card transition-all duration-300 hover:-translate-y-1.5 hover:border-brand/30 hover:shadow-brand`}
          >
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand transition-colors group-hover:bg-brand group-hover:text-white">
              <f.icon className="h-7 w-7" />
            </div>
            <h3 className="mt-5 font-display text-xl font-bold text-ink">{f.title}</h3>
            <p className="mt-2 leading-relaxed text-muted">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default Features;
