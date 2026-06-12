import { PlayIcon, HeartIcon, UploadIcon } from "../Icons";
import UnsplashImage from "./UnsplashImage";

// A pure-CSS phone showing a mini Bideo feed — no real device assets needed.
const PhoneMockup = () => (
  <div className="relative mx-auto w-[260px] sm:w-[290px]">
    <div className="relative rounded-[2.6rem] border-[10px] border-ink bg-ink shadow-2xl">
      {/* notch */}
      <div className="absolute left-1/2 top-0 z-20 h-5 w-28 -translate-x-1/2 rounded-b-2xl bg-ink" />
      <div className="relative h-[540px] overflow-hidden rounded-[1.9rem] bg-surface">
        {/* app header */}
        <div className="flex items-center justify-between px-4 pb-2 pt-5">
          <span className="font-display text-base font-bold text-ink">
            Bi<span className="text-brand">deo</span>
          </span>
          <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-[11px] font-bold text-white">
            B
          </span>
        </div>

        {/* hero video card */}
        <div className="px-3">
          <div className="relative overflow-hidden rounded-2xl">
            <UnsplashImage
              id="photo-1611162617474-5b21e879e113"
              alt="Featured video"
              w={500}
              className="h-40 w-full object-cover"
            />
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-white/90 text-brand shadow-lg">
                <PlayIcon className="h-6 w-6" />
              </span>
            </span>
            <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
              12:04
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-[13px] font-semibold leading-snug text-ink">
            Building India's next big creator community 🚀
          </p>
          <p className="text-[11px] text-muted">Bideo Originals · 1.2M views</p>
        </div>

        {/* list rows */}
        <div className="mt-3 space-y-3 px-3">
          {[
            { id: "photo-1516251193007-45ef944ab0c6", t: "Street food tour" },
            { id: "photo-1522869635100-9f4c5e86aa37", t: "Daily vlog: city life" },
          ].map((r) => (
            <div key={r.id} className="flex gap-2">
              <UnsplashImage
                id={r.id}
                alt={r.t}
                w={200}
                className="h-12 w-20 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold text-ink">{r.t}</p>
                <p className="text-[10px] text-muted">340K views · 2d</p>
              </div>
            </div>
          ))}
        </div>

        {/* bottom tab bar */}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-around border-t border-line bg-white/95 py-2 backdrop-blur">
          <PlayIcon className="h-5 w-5 text-brand" />
          <HeartIcon className="h-5 w-5 text-muted" />
          <span className="grid h-9 w-9 -translate-y-2 place-items-center rounded-full bg-brand text-white shadow-brand">
            <UploadIcon className="h-5 w-5" />
          </span>
          <PlayIcon className="h-5 w-5 text-muted" />
          <span className="h-5 w-5 rounded-full bg-muted/40" />
        </div>
      </div>
    </div>
  </div>
);

export default PhoneMockup;
