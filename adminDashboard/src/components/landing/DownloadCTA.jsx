import DownloadButton from "../DownloadButton";

const DownloadCTA = () => (
  <section className="py-12 sm:py-16">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="reveal relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-brand-dark to-brand-darker bg-[length:200%_200%] px-6 py-14 text-center shadow-lg sm:px-12 animate-gradient-pan">
        {/* decorative blobs */}
        <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -right-8 h-52 w-52 rounded-full bg-white/10 blur-2xl" />

        <h2 className="relative font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Ready to start earning on Bideo?
        </h2>
        <p className="relative mx-auto mt-4 max-w-xl text-lg text-white/90">
          Download the app now and start earning today — whether you watch,
          create, or share videos on Bideo.
        </p>
        <div className="relative mt-8 flex justify-center">
          <DownloadButton size="lg" variant="solid" label="Download the app" />
        </div>
      </div>
    </div>
  </section>
);

export default DownloadCTA;
