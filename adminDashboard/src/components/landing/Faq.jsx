import { useState } from "react";
import { ChevronDownIcon } from "../Icons";

const faqs = [
  {
    q: "Is Bideo free to use?",
    a: "Yes. Watching videos and shorts is completely free. You only need to sign in when you want to like, comment, subscribe or upload.",
  },
  {
    q: "How do I download the app?",
    a: "Tap any “Download App” button on this page to get the latest Android APK. Install it on your phone and you're ready to go.",
  },
  {
    q: "Do I need an account to watch?",
    a: "No. Bideo opens straight to the home feed so you can browse and watch right away. An account is only required for actions like uploading or subscribing.",
  },
  {
    q: "Can I upload my own videos?",
    a: "Absolutely. Create your channel, then upload long videos or shorts with thumbnails, categories and visibility controls — all from your phone.",
  },
  {
    q: "Is an iOS version available?",
    a: "We're starting with Android. The app is built with a cross-platform stack, so an iOS release can follow as we grow.",
  },
];

const FaqItem = ({ item, open, onToggle }) => (
  <div className="reveal overflow-hidden rounded-2xl border border-line bg-white shadow-card">
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
    >
      <span className="font-display text-lg font-semibold text-ink">{item.q}</span>
      <ChevronDownIcon
        className={`h-5 w-5 shrink-0 text-brand transition-transform duration-300 ${
          open ? "rotate-180" : ""
        }`}
      />
    </button>
    <div
      className={`grid transition-all duration-300 ease-out ${
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      }`}
    >
      <div className="overflow-hidden">
        <p className="px-6 pb-5 leading-relaxed text-muted">{item.a}</p>
      </div>
    </div>
  </div>
);

const Faq = () => {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="bg-surface py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="reveal text-center">
          <span className="text-sm font-bold uppercase tracking-wider text-brand">
            FAQ
          </span>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Frequently asked questions
          </h2>
        </div>

        <div className="mt-12 space-y-4">
          {faqs.map((item, i) => (
            <FaqItem
              key={item.q}
              item={item}
              open={open === i}
              onToggle={() => setOpen(open === i ? -1 : i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Faq;
