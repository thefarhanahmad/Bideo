import { DownloadIcon, PlayIcon, UsersIcon } from "../Icons";

const steps = [
  {
    icon: DownloadIcon,
    title: "Download the app",
    desc: "Grab the Bideo Android app and install it in seconds. No sign-up wall to get started.",
  },
  {
    icon: PlayIcon,
    title: "Watch & create",
    desc: "Explore the home feed and shorts, then upload your own videos when you're ready.",
  },
  {
    icon: UsersIcon,
    title: "Grow your audience",
    desc: "Build your channel, gain followers and engage with your community as you grow.",
  },
];

const HowItWorks = () => (
  <section id="how" className="bg-surface py-20 sm:py-28">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="reveal mx-auto max-w-2xl text-center">
        <span className="text-sm font-bold uppercase tracking-wider text-brand">
          Get started
        </span>
        <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Up and running in three steps
        </h2>
      </div>

      <div className="relative mt-16 grid gap-10 md:grid-cols-3">
        {/* connecting line */}
        <div className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-brand/30 to-transparent md:block" />
        {steps.map((s, i) => (
          <div key={s.title} className={`reveal reveal-delay-${i + 1} relative text-center`}>
            <div className="relative z-10 mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand text-white shadow-brand">
              <s.icon className="h-7 w-7" />
              <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full border-2 border-surface bg-ink text-xs font-bold text-white">
                {i + 1}
              </span>
            </div>
            <h3 className="mt-5 font-display text-xl font-bold text-ink">{s.title}</h3>
            <p className="mx-auto mt-2 max-w-xs leading-relaxed text-muted">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorks;
