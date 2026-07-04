import DownloadButton from "../DownloadButton";

const DownloadCTA = () => (
  <section className="py-12 sm:py-16">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="reveal relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-brand-dark to-brand-darker bg-[length:200%_200%] px-6 py-14 text-center shadow-lg sm:px-12 animate-gradient-pan">
        <h2 className="relative font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Ready to explore Bideo?
        </h2>
        <p className="relative mx-auto mt-4 max-w-xl text-lg text-white/90">
          Download the Android app to watch videos, explore shorts, create a
          channel, and share original content responsibly.
        </p>
        <div className="relative mt-8 flex justify-center">
          <DownloadButton size="lg" variant="solid" label="Download the app" />
        </div>
      </div>
    </div>
  </section>
);

export default DownloadCTA;
