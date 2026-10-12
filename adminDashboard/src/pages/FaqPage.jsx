import { useState, useEffect } from "react";
import InfoPage, { Section } from "../components/InfoPage";
import { ChevronDownIcon, SparkIcon } from "../components/Icons";

const faqCategories = [
  {
    category: "General",
    items: [
      {
        q: "What is Bideo?",
        a: "Bideo is India's modern mobile-first video sharing platform where creators and viewers connect through short videos (Shorts), long-form videos, and community posts. It is designed specifically for Indian languages, creators, and audiences."
      },
      {
        q: "Is Bideo free to use?",
        a: "Yes, 100% free! You can browse, watch, and discover trending videos and shorts without any subscription fees. Account creation is only needed when you want to upload, comment, like, follow, or create a channel."
      },
      {
        q: "Where can I download the Bideo app?",
        a: "You can download the official Bideo Android app directly from the Google Play Store by searching for 'Bideo' or clicking any of the 'Download App' buttons on our official website (https://bideo.in)."
      },
      {
        q: "Is Bideo an Indian app?",
        a: "Yes. Bideo is proudly built in India for Indian audiences, supporting regional languages, diverse Indian cultures, and homegrown content creators."
      }
    ]
  },
  {
    category: "For Creators",
    items: [
      {
        q: "How can I start creating on Bideo?",
        a: "Simply download the Bideo app, register with your phone number or Google account, tap the '+' Upload button, and upload your first short or long video with a custom title, tags, and thumbnail."
      },
      {
        q: "Can creators earn money on Bideo?",
        a: "Bideo is actively developing creator monetization programs, including creator reward pools, virtual gifts, and brand sponsorships for eligible creators who maintain active channels and comply with community guidelines. Check your in-app Analytics dashboard for updates."
      },
      {
        q: "What video formats and durations are supported?",
        a: "Bideo supports vertical short videos (9:16 aspect ratio up to 60 seconds) and standard landscape or portrait videos (up to 1080p Full HD) in MP4 and MOV formats."
      },
      {
        q: "How do I grow my audience on Bideo?",
        a: "Post consistently in your chosen niche (comedy, dance, tech, education, vlogs), use descriptive titles and trending hashtags, and share your unique Bideo profile link (bideo.in/c/your-id) across WhatsApp and Instagram."
      }
    ]
  },
  {
    category: "Safety & Policy",
    items: [
      {
        q: "How does Bideo handle unsafe or pirated content?",
        a: "Bideo maintains zero tolerance for hate speech, harassment, explicit adult content, and copyright violations. Every video and profile has a built-in 'Report' button. Our moderation team reviews reports 24/7 and suspends offending accounts."
      },
      {
        q: "How do I report a copyright violation or submit a DMCA takedown?",
        a: "If you believe your copyrighted work is uploaded without authorization, email us at bideoapps@gmail.com with the video link and proof of ownership. We process takedown requests promptly under our Copyright Policy."
      },
      {
        q: "How can I delete my Bideo account and personal data?",
        a: "You can delete your account directly in the mobile app: go to Library → Settings (gear icon) → Delete Profile. Alternatively, visit our web deletion form at https://bideo.in/account-deletion."
      }
    ]
  }
];

const FaqPage = () => {
  const [activeIndices, setActiveIndices] = useState({ "0-0": true });

  useEffect(() => {
    document.title = "Frequently Asked Questions (FAQ) — Bideo";
    window.scrollTo(0, 0);
  }, []);

  const toggle = (key) => {
    setActiveIndices((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Build Schema.org FAQPage structured data
  const allQuestions = faqCategories.flatMap((cat) => cat.items);
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": allQuestions.map((item) => ({
      "@type": "Question",
      "name": item.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.a
      }
    }))
  };

  return (
    <InfoPage
      title="Frequently Asked Questions"
      subtitle="Find quick answers to common questions about watching, creating, earning, and safety on Bideo."
      updated="October 2026"
    >
      {/* Schema.org FAQPage JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="rounded-2xl border border-brand/20 bg-brand-50/40 p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-white shadow-sm">
            <SparkIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-ink sm:text-lg">Need Immediate Help?</h3>
            <p className="mt-1 text-xs text-muted sm:text-sm">
              Can't find what you're looking for? Reach out to our 24/7 user support team anytime at{" "}
              <a href="mailto:bideoapps@gmail.com" className="font-semibold text-brand hover:underline">
                bideoapps@gmail.com
              </a>.
            </p>
          </div>
        </div>
      </div>

      {faqCategories.map((cat, catIdx) => (
        <Section key={cat.category} heading={cat.category}>
          <div className="space-y-3">
            {cat.items.map((item, itemIdx) => {
              const key = `${catIdx}-${itemIdx}`;
              const isOpen = !!activeIndices[key];

              return (
                <div
                  key={item.q}
                  className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition-all duration-200"
                >
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    className="flex w-full items-center justify-between gap-4 p-4 text-left sm:p-5"
                    aria-expanded={isOpen}
                  >
                    <span className="font-display text-sm font-semibold text-ink sm:text-base">
                      {item.q}
                    </span>
                    <ChevronDownIcon
                      className={`h-5 w-5 shrink-0 text-brand transition-transform duration-300 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <div
                    className={`grid transition-all duration-300 ease-out ${
                      isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="border-t border-line/60 bg-surface/30 px-4 py-3.5 text-xs leading-relaxed text-muted sm:px-5 sm:py-4 sm:text-sm">
                        {item.a}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      ))}
    </InfoPage>
  );
};

export default FaqPage;
