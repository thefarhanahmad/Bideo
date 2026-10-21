import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Logo from "../Logo";
import DownloadButton from "../DownloadButton";
import { MenuIcon, CloseIcon } from "../Icons";

const links = [
  { label: "Features", href: "/#features" },
  { label: "How it works", href: "/#how" },
  { label: "Creators", to: "/creators" },
  { label: "FAQ", to: "/faq" },
  { label: "About", to: "/about" },
  { label: "Blog", to: "/blog" },
];

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white/95 shadow-card backdrop-blur" : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="shrink-0" onClick={() => setOpen(false)}>
          <Logo />
        </Link>

        <div className="hidden items-center gap-7 lg:gap-8 md:flex">
          {links.map((l) =>
            l.to ? (
              <Link
                key={l.to}
                to={l.to}
                className="text-sm font-medium text-ink/80 transition-colors hover:text-brand"
              >
                {l.label}
              </Link>
            ) : (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-ink/80 transition-colors hover:text-brand"
              >
                {l.label}
              </a>
            )
          )}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <DownloadButton size="sm" />
        </div>

        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-lg text-ink md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? (
            <CloseIcon className="h-6 w-6" />
          ) : (
            <MenuIcon className="h-6 w-6" />
          )}
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-line bg-white px-4 py-4 md:hidden shadow-lg animate-fade-down">
          <div className="flex flex-col gap-2.5">
            {links.map((l) =>
              l.to ? (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-ink/80 hover:bg-brand-50 hover:text-brand"
                >
                  {l.label}
                </Link>
              ) : (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-ink/80 hover:bg-brand-50 hover:text-brand"
                >
                  {l.label}
                </a>
              )
            )}
            <div className="pt-2">
              <DownloadButton size="sm" className="w-full justify-center" />
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
