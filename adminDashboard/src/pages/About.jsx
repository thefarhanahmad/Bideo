import { useEffect } from "react";
import InfoPage, { Section } from "../components/InfoPage";
import DownloadButton from "../components/DownloadButton";
import { SparkIcon, UsersIcon, ShieldIcon, PlayIcon, ShortsIcon, TrendingUpIcon } from "../components/Icons";

const highlights = [
  {
    title: "Mobile-First Design",
    desc: "Built from the ground up for seamless smartphone streaming, vertical full-screen Shorts, and rapid mobile video uploads.",
    icon: ShortsIcon
  },
  {
    title: "Regional Language Focus",
    desc: "Connecting communities across India in Hindi, Bhojpuri, Punjabi, Tamil, Telugu, and English without language barriers.",
    icon: SparkIcon
  },
  {
    title: "Fair Creator Growth",
    desc: "An algorithmic recommendation engine that surfaces fresh, entertaining talent rather than only established celebrity accounts.",
    icon: TrendingUpIcon
  },
  {
    title: "Safety & Integrity",
    desc: "Continuous automated & human moderation to protect our community against harassment, copyright infringement, and spam.",
    icon: ShieldIcon
  }
];

const About = () => {
  useEffect(() => {
    document.title = "About Us — Bideo: India's Short Video Platform";
    window.scrollTo(0, 0);
  }, []);

  return (
    <InfoPage
      title="About Bideo"
      subtitle="India's modern mobile-first video sharing platform for watching, creating, and connecting with original regional content."
      updated="October 2026"
    >
      {/* Platform Highlight Card */}
      <div className="rounded-2xl border border-brand/20 bg-gradient-to-r from-brand/10 via-brand-50 to-white p-6 sm:p-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
          <SparkIcon className="h-3.5 w-3.5" /> Watch. Create. Grow.
        </span>
        <h2 className="mt-4 font-display text-2xl font-extrabold text-ink sm:text-3xl">
          Empowering India’s Next Generation of Video Creators
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
          Bideo was founded with a clear, singular vision: to give every Indian creator—from bustling metros to regional towns—a high-performance, respectful platform to share their voice, tell their stories, and reach millions of passionate viewers.
        </p>

        {/* Stats strip */}
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-brand/20 pt-6 sm:grid-cols-3">
          <div>
            <div className="font-display text-2xl font-black text-brand sm:text-3xl">50K+</div>
            <div className="text-xs text-muted">Play Store Installs</div>
          </div>
          <div>
            <div className="font-display text-2xl font-black text-brand sm:text-3xl">40,000+</div>
            <div className="text-xs text-muted">Videos Published</div>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <div className="font-display text-2xl font-black text-brand sm:text-3xl">4.7 ★</div>
            <div className="text-xs text-muted">User Satisfaction Rating</div>
          </div>
        </div>
      </div>

      {/* Core Platform Pillars */}
      <Section heading="What Makes Bideo Different">
        <div className="grid gap-4 sm:grid-cols-2">
          {highlights.map((h) => {
            const Icon = h.icon;
            return (
              <div
                key={h.title}
                className="rounded-2xl border border-line bg-white p-5 shadow-sm transition-all hover:shadow-md"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-3 font-display text-base font-bold text-ink sm:text-lg">
                  {h.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-muted sm:text-sm">
                  {h.desc}
                </p>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Mission Section */}
      <Section heading="Our Mission">
        <p>
          We are dedicated to building a simple, clean, and reliable digital entertainment ecosystem. Unlike platforms cluttered with intrusive friction, Bideo focuses on what matters most: lightning-fast video delivery, engaging regional storytelling, and genuine creator community connections.
        </p>
      </Section>

      {/* Trust & Compliance */}
      <Section heading="Safety, Privacy & Responsibility">
        <p>
          As an Indian intermediary platform under the Digital Personal Data Protection (DPDP) framework and Information Technology Rules, 2021, Bideo takes user privacy and safety seriously. We provide clear reporting tools, proactive moderation, and transparent community guidelines so viewers of all ages can enjoy content safely.
        </p>
      </Section>

      {/* CTA Box */}
      <div className="rounded-2xl border border-ink bg-ink p-6 text-center text-white sm:p-8">
        <h3 className="font-display text-xl font-bold sm:text-2xl">Experience Bideo on Your Phone</h3>
        <p className="mx-auto mt-2 max-w-md text-xs text-white/70 sm:text-sm">
          Join India's fastest-growing video community today. Download the app free from Google Play Store.
        </p>
        <div className="mt-5 flex justify-center">
          <DownloadButton size="md" />
        </div>
      </div>
    </InfoPage>
  );
};

export default About;
