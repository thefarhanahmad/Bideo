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
    title: "Watch anything",
    desc: "Stream long-form videos in a smooth, optimized player with a clean, distraction-free view.",
  },
  {
    icon: ShortsIcon,
    title: "Shorts feed",
    desc: "Swipe through bite-sized vertical videos with auto-play, double-tap likes and instant sharing.",
  },
  {
    icon: UploadIcon,
    title: "Upload in seconds",
    desc: "Publish videos and shorts with thumbnails, categories and public or private visibility.",
  },
  {
    icon: UsersIcon,
    title: "Build your channel",
    desc: "Grow followers, customize your channel and keep your audience coming back for more.",
  },
  {
    icon: ListIcon,
    title: "Playlists & history",
    desc: "Save videos into playlists, like what you love and pick up right where you left off.",
  },
  {
    icon: ShieldIcon,
    title: "Easy & secure login",
    desc: "Sign in with Google or phone. Watch freely — login is only needed when you take action.",
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
          Bideo packs a full creator toolkit into a fast, mobile-first experience.
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
