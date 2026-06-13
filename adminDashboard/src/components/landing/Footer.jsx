import { Link } from "react-router-dom";
import Logo from "../Logo";
import DownloadButton from "../DownloadButton";

const cols = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "How it works", href: "/#how" },
      { label: "Earn while watching", href: "/#earn" },
      { label: "FAQ", href: "/#faq" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", to: "/about" },
      { label: "Contact", to: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms & Conditions", to: "/terms" },
      { label: "Privacy Policy", to: "/privacy" },
      { label: "Community Guidelines", to: "/guidelines" },
    ],
  },
];

const Footer = () => (
  <footer className="bg-ink text-white">
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Logo dark />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">
            The mobile-first video platform for India. Watch, create and grow
            your audience — all in one beautiful app.
          </p>
          <div className="mt-6">
            <DownloadButton size="sm" />
          </div>
        </div>

        {cols.map((col) => (
          <div key={col.title}>
            <h4 className="font-display text-sm font-bold uppercase tracking-wider text-white/80">
              {col.title}
            </h4>
            <ul className="mt-4 space-y-3">
              {col.links.map((l) => (
                <li key={l.label}>
                  {l.to ? (
                    <Link
                      to={l.to}
                      className="text-sm text-white/60 transition-colors hover:text-brand-light"
                    >
                      {l.label}
                    </Link>
                  ) : (
                    <a
                      href={l.href}
                      className="text-sm text-white/60 transition-colors hover:text-brand-light"
                    >
                      {l.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
        <p className="text-sm text-white/50">
          © 2026 Bideo Platform. All rights reserved.
        </p>
      </div>
    </div>
  </footer>
);

export default Footer;
