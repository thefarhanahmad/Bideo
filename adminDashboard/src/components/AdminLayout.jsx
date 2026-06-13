import { useState } from "react";
import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import Logo from "./Logo";
import {
  GridIcon,
  UsersIcon,
  TagIcon,
  PlayIcon,
  FlagIcon,
  LogoutIcon,
  MenuIcon,
  CloseIcon,
} from "./Icons";

const nav = [
  { to: "/admin", label: "Dashboard", icon: GridIcon, end: true },
  { to: "/admin/users", label: "Users", icon: UsersIcon },
  { to: "/admin/categories", label: "Categories", icon: TagIcon },
  { to: "/admin/videos", label: "Videos", icon: PlayIcon },
  { to: "/admin/reports", label: "Reports", icon: FlagIcon },
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

  const SidebarContent = () => (
    <>
      <Link to="/" className="flex items-center gap-2 px-2 py-1">
        <Logo />
      </Link>

      <nav className="mt-6 space-y-1.5">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={linkClass}
            onClick={() => setOpen(false)}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </>
  );

  return (
    <div className="min-h-screen bg-surface font-sans text-ink">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-line bg-white p-4 lg:flex">
        <SidebarContent />
        <button
          onClick={logout}
          className="mt-auto flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          <LogoutIcon className="h-5 w-5" /> Logout
        </button>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-line bg-white p-4">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 text-muted"
              aria-label="Close menu"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
            <SidebarContent />
            <button
              onClick={logout}
              className="mt-auto flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              <LogoutIcon className="h-5 w-5" /> Logout
            </button>
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-lg text-ink lg:hidden"
              aria-label="Open menu"
            >
              <MenuIcon className="h-6 w-6" />
            </button>
            <h1 className="font-display text-lg font-bold text-ink">
              Dashboard
            </h1>
          </div>
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600"
          >
            <LogoutIcon className="h-4 w-4" /> Logout
          </button>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
