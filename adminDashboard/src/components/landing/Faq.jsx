import { useState } from "react";
import { ChevronDownIcon } from "../Icons";

const faqs = [
  {
    q: "Is Bideo free to use?",
    a: "Yes. You can browse and watch videos for free. Sign-in is required for actions such as uploading, commenting, following creators, and managing your profile.",
  },
  {
    q: "How do I download the app?",
    a: "Use any Download App button on this website to get the Android app. Only install Bideo from links provided by Bideo or trusted app distribution channels.",
  },
  {
    q: "Can I upload my own videos?",
    a: "Yes. You may upload original videos or content you have permission to share. Content must follow our Community Guidelines, copyright rules, and applicable law.",
  },
  {
    q: "Does Bideo guarantee earnings?",
    a: "No. Bideo does not guarantee income, rewards, payouts, or audience growth. Creator monetization features are planned for eligible creators in the future and may be subject to review, policy compliance, and additional terms.",
  },
  {
    q: "How does Bideo handle unsafe content?",
    a: "Users can report content in the app. We review reports and may remove content, limit distribution, or suspend accounts that violate our policies.",
  },
  {
    q: "Is an iOS version available?",
    a: "Bideo is currently focused on Android. Future platform availability may change as the product develops.",
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
