import DownloadButton from "../DownloadButton";
import PhoneMockup from "./PhoneMockup";
import { PlayIcon, SparkIcon } from "../Icons";

const Hero = () => (
  <section className="relative overflow-hidden pt-28 pb-20 sm:pt-32 lg:pt-40">
    {/* animated background */}
    <div className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute inset-0 bg-gradient-to-b from-brand-50 via-white to-white" />
      <div className="absolute -left-24 top-10 h-72 w-72 animate-float rounded-full bg-brand/20 blur-3xl" />
      <div className="absolute -right-16 top-40 h-80 w-80 animate-float rounded-full bg-brand-light/25 blur-3xl [animation-delay:1.5s]" />
    </div>

    <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:px-8">
      <div className="text-center lg:text-left">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/8 px-4 py-1.5 text-sm font-semibold text-brand shadow-sm">
          <SparkIcon className="h-4 w-4" /> India's Trending Short Video App
        </span>

        <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-6xl">
          Watch, create &amp; earn on{" "}
          <span className="bg-gradient-to-r from-brand-dark to-brand bg-clip-text text-transparent">
            Bideo App
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted lg:mx-0">
          Bideo App is India's premier short video and reels platform. Watch trending viral shorts, comedy sketches, romantic shayari, and earn creator rewards.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
          <a
            href="https://play.google.com/store/apps/details?id=com.farhan.bideoapp"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#c44b00] border border-[#b24500] text-white px-7 py-4 text-base font-semibold shadow-[0_22px_60px_rgba(196,75,0,0.35)] hover:bg-[#e26b00] hover:shadow-[0_26px_70px_rgba(226,107,0,0.40)] transform hover:-translate-y-1 transition-all"
          >
            Get it on Google Play
          </a>
          <DownloadButton size="lg" variant="white" label="Download APK" />
        </div>

        <div className="mt-8 flex flex-col items-center gap-3 text-sm text-muted lg:flex-row lg:justify-start">
          <span>
            <strong className="text-ink">Watch</strong> videos and shorts
          </span>
          <span className="hidden h-4 w-px bg-line lg:inline-block" />
          <span>
            <strong className="text-ink">Android</strong> app available
          </span>
          <span className="hidden h-4 w-px bg-line lg:inline-block" />
          <span>
            <strong className="text-ink">Create</strong> your own channel
          </span>
        </div>
      </div>

      <div className="relative animate-fade-up">
        <PhoneMockup />
      </div>
    </div>
  </section>
);

export default Hero;
