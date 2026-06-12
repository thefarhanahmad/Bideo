import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Logo from "../Logo";
import DownloadButton from "../DownloadButton";
import { MenuIcon, CloseIcon } from "../Icons";

const links = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how" },
  { label: "FAQ", href: "#faq" },
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
        scrolled ? "bg-white/90 shadow-card backdrop-blur" : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="shrink-0">
          <Logo />
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-ink/80 transition-colors hover:text-brand"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            to="/login"
            className="text-sm font-semibold text-ink/80 transition-colors hover:text-brand"
          >
            Admin Login
          </Link>
          <DownloadButton size="sm" />
        </div>

        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-lg text-ink md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <MenuIcon className="hidden" /> : null}
          {open ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-line bg-white px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-2 text-sm font-medium text-ink/80 hover:bg-brand-50 hover:text-brand"
              >
                {l.label}
              </a>
            ))}
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-2 text-sm font-semibold text-ink/80 hover:bg-brand-50 hover:text-brand"
            >
              Admin Login
            </Link>
            <DownloadButton size="sm" className="w-full" />
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
