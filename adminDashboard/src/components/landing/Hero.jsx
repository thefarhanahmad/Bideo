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
        <span className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-white px-4 py-1.5 text-sm font-semibold text-brand shadow-sm">
          <SparkIcon className="h-4 w-4" /> Made in India · For creators
        </span>

        <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-6xl">
          Watch, create &amp; grow on{" "}
          <span className="bg-gradient-to-r from-brand to-brand-light bg-clip-text text-transparent">
            Bideo
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted lg:mx-0">
          The fast, mobile-first video platform for India. Stream long videos and
          shorts, build your channel, and reach your audience — all in one clean,
          beautiful app.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
          <DownloadButton size="lg" />
          <a
            href="#features"
            className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-line bg-white px-7 py-4 text-base font-semibold text-ink transition-all hover:-translate-y-0.5 hover:border-brand hover:text-brand"
          >
            <PlayIcon className="h-5 w-5" /> See features
          </a>
        </div>

        <div className="mt-8 flex items-center justify-center gap-6 text-sm text-muted lg:justify-start">
          <span><strong className="text-ink">Free</strong> to use</span>
          <span className="h-4 w-px bg-line" />
          <span><strong className="text-ink">Android</strong> APK ready</span>
          <span className="h-4 w-px bg-line" />
          <span><strong className="text-ink">No ads</strong> to watch</span>
        </div>
      </div>

      <div className="relative animate-fade-up">
        <PhoneMockup />
      </div>
    </div>
  </section>
);

export default Hero;
