import UnsplashImage from "./UnsplashImage";

const highlights = [
  { value: "HD", label: "Smooth playback" },
  { value: "Shorts", label: "Vertical video feed" },
  { value: "Channels", label: "For creators" },
  { value: "Free", label: "To start watching" },
];

const Showcase = () => (
  <section className="py-20 sm:py-28">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div className="reveal grid grid-cols-2 gap-4">
          <div className="space-y-4">
            <UnsplashImage
              id="photo-1567593810070-7a3d471af022"
              alt="Creator filming a video"
              w={500}
              className="h-48 w-full rounded-2xl object-cover shadow-card sm:h-56"
            />
            <UnsplashImage
              id="photo-1516251193007-45ef944ab0c6"
              alt="People watching content together"
              w={500}
              className="h-36 w-full rounded-2xl object-cover shadow-card"
            />
          </div>
          <div className="space-y-4 pt-8">
            <UnsplashImage
              id="photo-1611162616305-c69b3fa7fbe0"
              alt="Person using a phone"
              w={500}
              className="h-36 w-full rounded-2xl object-cover shadow-card"
            />
            <UnsplashImage
              id="photo-1492619375914-88005aa9e8fb"
              alt="Creating content"
              w={500}
              className="h-48 w-full rounded-2xl object-cover shadow-card sm:h-56"
            />
          </div>
        </div>

        <div className="reveal reveal-delay-1">
          <span className="text-sm font-bold uppercase tracking-wider text-brand">
            Built for mobile viewing
          </span>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            A fast experience for viewers and creators
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted">
            Fast lists, lazy-loaded media, and a clean interface help Bideo feel
            light and reliable whether you are browsing shorts, watching videos,
            or uploading original work.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-4">
            {highlights.map((h) => (
              <div
                key={h.label}
                className="rounded-2xl border border-line bg-white p-5 shadow-card"
              >
                <div className="font-display text-2xl font-extrabold text-brand">
                  {h.value}
                </div>
                <div className="mt-1 text-sm text-muted">{h.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default Showcase;
