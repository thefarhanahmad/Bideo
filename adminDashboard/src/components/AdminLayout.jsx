import { useState } from "react";
import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import Logo from "./Logo";
import AdminGlobalSearch from "./AdminGlobalSearch";
import {
  GridIcon,
  UsersIcon,
  TagIcon,
  PlayIcon,
  FlagIcon,
  LogoutIcon,
  MenuIcon,
  CloseIcon,
  TvIcon,
  WalletIcon,
  CashIcon,
  AlertOctagonIcon,
  TrendingUpIcon,
  RocketIcon,
  ServerIcon,
  MessageSquareIcon,
  StoryIcon,
} from "./Icons";

const nav = [
  { to: "/admin", label: "Dashboard", icon: GridIcon, end: true },
  { to: "/admin/users", label: "Users", icon: UsersIcon },
  { to: "/admin/categories", label: "Categories", icon: TagIcon },
  { to: "/admin/videos", label: "Videos", icon: PlayIcon },
  { to: "/admin/stories", label: "Stories", icon: StoryIcon },
  { to: "/admin/server-videos", label: "Server Videos", icon: ServerIcon },
  { to: "/admin/conversations", label: "Conversations", icon: MessageSquareIcon },
  { to: "/admin/reports", label: "Reports", icon: FlagIcon },
  { to: "/admin/ads", label: "Ads", icon: TvIcon },
  { to: "/admin/monetization", label: "Monetization", icon: WalletIcon },
  { to: "/admin/earnings", label: "User Earnings", icon: TrendingUpIcon },
  { to: "/admin/boost", label: "Channel Boost", icon: RocketIcon },
  { to: "/admin/payouts", label: "Payouts", icon: CashIcon },
  { to: "/admin/error-logs", label: "Error Logs", icon: AlertOctagonIcon },
];

const AdminLayout = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const logout = () => {
    localStorage.removeItem("admin_token");
    navigate("/login");
  };

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
      isActive
        ? "bg-brand text-white shadow-brand"
        : "text-ink/70 hover:bg-brand-50 hover:text-brand"
    }`;

  const SidebarNav = ({ onClose }) => (
    <div className="flex flex-col h-full min-h-0">
      {/* Fixed Header / Logo */}
      <div className="shrink-0 px-2 py-1">
        <Link to="/" className="flex items-center gap-2" onClick={onClose}>
          <Logo />
        </Link>
      </div>

      {/* Scrollable Navigation Links */}
      <nav className="mt-4 flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1.5 sidebar-scroll">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={linkClass}
            onClick={onClose}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Fixed Footer: Logout Button */}
      <div className="mt-auto pt-3 border-t border-line shrink-0">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          <LogoutIcon className="h-5 w-5 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface font-sans text-ink">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 h-screen max-h-screen flex-col border-r border-line bg-white p-4 lg:flex z-30">
        <SidebarNav onClose={() => setOpen(false)} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] h-screen max-h-screen flex-col border-r border-line bg-white p-4 shadow-2xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3.5 top-3.5 grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink transition-colors z-10"
              aria-label="Close menu"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
            <SidebarNav onClose={() => setOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="lg:pl-64 min-w-0 max-w-full overflow-x-hidden">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 sm:gap-4 border-b border-line bg-white/95 px-4 py-2.5 backdrop-blur sm:px-6 min-w-0">
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <button
              onClick={() => setOpen(true)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-ink lg:hidden hover:bg-surface"
              aria-label="Open menu"
            >
              <MenuIcon className="h-6 w-6" />
            </button>
            <h1 className="font-display text-base sm:text-lg font-bold text-ink truncate hidden md:block">
              Dashboard
            </h1>
          </div>

          {/* Global Search Omnibox */}
          <div className="flex-1 max-w-xl mx-1 sm:mx-4 min-w-0">
            <AdminGlobalSearch />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-red-500 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-red-600 shrink-0 shadow-xs"
            >
              <LogoutIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        <main className="p-3.5 sm:p-6 lg:p-8 min-w-0 max-w-full overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
