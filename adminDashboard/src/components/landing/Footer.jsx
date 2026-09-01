import { Link } from "react-router-dom";
import Logo from "../Logo";
import DownloadButton from "../DownloadButton";

const InstagramIcon = ({ className = "w-5 h-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const FacebookIcon = ({ className = "w-5 h-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const PlayStoreIcon = ({ className = "w-5 h-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M3.609 1.814L13.792 12 3.61 22.186a2.38 2.38 0 0 1-.61-.786 2.44 2.44 0 0 1-.222-1.048V3.648c0-.387.077-.745.222-1.048a2.38 2.38 0 0 1 .61-.786zm11.24 11.24l2.58 2.58-12.09 6.98 9.51-9.56zm0-2.108L5.34 1.386l12.09 6.98-2.58 2.58zm1.06 1.054l3.19 1.84a1.86 1.86 0 0 1 0 3.22l-3.19 1.84-2.26-2.26 2.26-2.64z" />
  </svg>
);

const socialLinks = [
  {
    name: "Instagram",
    href: "https://www.instagram.com/bideo.app/",
    icon: InstagramIcon,
    title: "Follow Bideo on Instagram",
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/profile.php?id=61591116000454",
    icon: FacebookIcon,
    title: "Follow Bideo on Facebook",
  },
  {
    name: "Google Play Store",
    href: "https://play.google.com/store/apps/details?id=com.farhan.bideoapp&utm_source=ig&utm_medium=social&utm_content=link_in_bio&fbclid=PAcGRvZgJleHRuA2FlbQIxMQBzcnRjBmFwcF9pZA85MzY2MTk3NDMzOTI0NTkAAac1S4A0KmtIWVXPUFuBb7Q1iB3a_-29GvSfO82s_MBlIw7jDqid1ZgaKKWztQ_aem_DXZ73qMl7_R9ZVUDSaz1NQ",
    icon: PlayStoreIcon,
    title: "Download Bideo on Google Play Store",
  },
];

const cols = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "How it works", href: "/#how" },
      { label: "Creators", href: "/#earn" },
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
    title: "Policies",
    links: [
      { label: "Terms", to: "/terms" },
      { label: "Privacy", to: "/privacy" },
      { label: "Community Guidelines", to: "/guidelines" },
      { label: "Copyright / DMCA", to: "/copyright" },
      { label: "Moderation", to: "/moderation" },
      { label: "Cookies", to: "/cookies" },
      { label: "Account Deletion", to: "/account-deletion" },
      { label: "Child Safety Standards", to: "/child-safety" },
      { label: "Refunds", to: "/refunds" },
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
            A mobile-first video platform for watching, creating, and building
            communities around original content.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <DownloadButton size="sm" />
          </div>

          {/* Social Links Row */}
          <div className="mt-6 flex items-center gap-3">
            {socialLinks.map((s) => {
              const Icon = s.icon;
              return (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  title={s.title}
                  aria-label={s.name}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80 transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand hover:text-white hover:shadow-lg hover:shadow-brand/30"
                >
                  <Icon className="h-5 w-5" />
                </a>
              );
            })}
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
          Copyright 2026 Bideo Platform. All rights reserved.
        </p>

        <div className="flex items-center gap-4 text-sm text-white/60">
          {socialLinks.map((s) => {
            const Icon = s.icon;
            return (
              <a
                key={s.name}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                title={s.title}
                className="flex items-center gap-1.5 transition-colors hover:text-brand-light"
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{s.name}</span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
