import { useEffect } from "react";
import InfoPage, { Section } from "../components/InfoPage";
import DownloadButton from "../components/DownloadButton";
import { UploadIcon, UsersIcon, TrendingUpIcon, ShieldIcon, SparkIcon, PlayIcon } from "../components/Icons";

const creatorSteps = [
  {
    step: "1",
    title: "Create Your Channel in Seconds",
    desc: "Download Bideo on Android, sign up with your mobile number or Google account, and customize your channel name, avatar, and bio to match your unique brand.",
    icon: UsersIcon
  },
  {
    step: "2",
    title: "Fast & Effortless Mobile Uploads",
    desc: "Upload vertical shorts (9:16) or standard videos directly from your phone. Our high-speed cloud infrastructure compresses and delivers your videos instantly across India without buffering.",
    icon: UploadIcon
  },
  {
    step: "3",
    title: "Reach Millions Across India",
    desc: "Whether you create comedy in Hindi, dance in Bhojpuri, tech reviews in Tamil, or daily vlogs in Punjabi, Bideo's recommendation algorithm connects your content with local, engaged audiences.",
    icon: TrendingUpIcon
  },
  {
    step: "4",
    title: "Real-time Analytics & Earnings",
    desc: "Track video views, watch hours, follower growth, and potential earnings from your personal in-app Creator Dashboard updated daily.",
    icon: SparkIcon
  }
];

const bestPractices = [
  "Post consistently (at least 3–5 videos per week) to build algorithm momentum.",
  "Hook your viewers within the first 2 seconds with an exciting visual or question.",
  "Use clear, keyword-rich titles and relevant hashtags (#comedy, #dance, #reels).",
  "Upload high-resolution video clips (1080p, well-lit, clear audio).",
  "Always upload original content that you own or have permission to share.",
  "Share your unique Bideo profile link (bideo.in/c/your-id) on WhatsApp and Instagram."
];

const Creators = () => {
  useEffect(() => {
    document.title = "For Creators — Watch, Create and Grow on Bideo";
    window.scrollTo(0, 0);
  }, []);

  return (
    <InfoPage
      title="For Creators on Bideo"
      subtitle="Turn your creativity into a thriving community. Build your audience, publish original videos, and grow with India's mobile-first video platform."
      updated="October 2026"
    >
      {/* Hero Highlight Banner */}
      <div className="rounded-2xl border border-brand/20 bg-gradient-to-r from-brand/10 via-brand-50 to-white p-6 sm:p-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
          <SparkIcon className="h-3.5 w-3.5" /> Made for Indian Creators
        </span>
        <h2 className="mt-4 font-display text-2xl font-extrabold text-ink sm:text-3xl">
          Your Stage. Your Voice. Your Community.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
          At Bideo, we believe every storyteller, comedian, educator, and entertainer deserves a fair chance to be discovered. Our platform prioritizes original regional creativity without favoring only celebrity accounts.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <DownloadButton size="sm" />
          <a
            href="mailto:bideoapps@gmail.com?subject=Creator%20Inquiry%20-%20Bideo"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-line bg-white px-5 py-2.5 text-xs font-semibold text-ink shadow-sm transition hover:bg-surface sm:text-sm"
          >
            Contact Creator Team
          </a>
        </div>
      </div>

      {/* 4 Steps to Growth */}
      <Section heading="How to Get Started as a Creator">
        <div className="grid gap-4 sm:grid-cols-2">
          {creatorSteps.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.step}
                className="relative overflow-hidden rounded-2xl border border-line bg-white p-5 shadow-sm transition-all hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="font-display text-2xl font-black text-brand/20">
                    0{s.step}
                  </span>
                </div>
                <h3 className="mt-3 font-display text-base font-bold text-ink sm:text-lg">
                  {s.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-muted sm:text-sm">
                  {s.desc}
                </p>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Creator Best Practices */}
      <Section heading="Creator Best Practices for Faster Growth">
        <div className="rounded-2xl border border-line bg-surface/40 p-5 sm:p-6">
          <ul className="space-y-3">
            {bestPractices.map((tip, idx) => (
              <li key={idx} className="flex items-start gap-3 text-xs leading-relaxed text-muted sm:text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                  ✓
                </span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Monetization & Policy Transparency */}
      <Section heading="Monetization & Guidelines">
        <p>
          Bideo maintains a clear, honest approach to creator earnings:
        </p>
        <div className="space-y-3 text-xs leading-relaxed text-muted sm:text-sm">
          <div className="rounded-xl border border-line bg-white p-4">
            <h4 className="font-bold text-ink">Transparent Standards</h4>
            <p className="mt-1">
              Bideo does not make false promises of guaranteed instant income. Monetization programs (including virtual gifting and creator pools) roll out to creators who achieve consistent organic engagement and comply with community standards.
            </p>
          </div>
          <div className="rounded-xl border border-line bg-white p-4">
            <h4 className="font-bold text-ink">Original Content Only</h4>
            <p className="mt-1">
              Re-uploading copyrighted TV shows, cinema clips without transformative commentary, or spam content will result in channel demonetization and possible account suspension.
            </p>
          </div>
        </div>
      </Section>

      {/* Bottom CTA */}
      <div className="rounded-2xl border border-ink bg-ink p-6 text-center text-white sm:p-8">
        <h3 className="font-display text-xl font-bold sm:text-2xl">Ready to Start Your Creator Journey?</h3>
        <p className="mx-auto mt-2 max-w-md text-xs text-white/70 sm:text-sm">
          Join thousands of Indian creators sharing laughter, knowledge, and entertainment every single day.
        </p>
        <div className="mt-5 flex justify-center">
          <DownloadButton size="md" />
        </div>
      </div>
    </InfoPage>
  );
};

export default Creators;
