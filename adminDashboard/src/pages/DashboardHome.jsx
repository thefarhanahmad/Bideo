import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../config';
import StatCard from '../components/StatCard';
import { UsersIcon, PlayIcon, TagIcon, FlagIcon, EyeIcon, ArrowRightIcon } from '../components/Icons';

const fmt = (n) => {
  const num = Number(n) || 0;
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toString();
};

const DashboardHome = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('admin_token');
        const res = await fetch(API_URL + '/api/admin/stats', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load stats');
        setStats(data.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div>
        <div className="h-8 w-48 animate-pulse rounded bg-line" />
        <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white shadow-card" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-red-700">
        <p className="font-semibold">Couldn't load dashboard stats</p>
        <p className="mt-1 text-sm">{error}</p>
      </div>
    );
  }

  const cards = [
    { icon: UsersIcon, label: 'Total Users', value: fmt(stats.users.total), hint: `${stats.users.admins} admins`, tone: 'brand' },
    { icon: PlayIcon, label: 'Videos', value: fmt(stats.videos.total), hint: `${stats.videos.public} public · ${stats.videos.private} private`, tone: 'blue' },
    { icon: EyeIcon, label: 'Total Views', value: fmt(stats.totalViews), hint: 'across all videos', tone: 'violet' },
    { icon: TagIcon, label: 'Categories', value: fmt(stats.categories.total), hint: 'content categories', tone: 'green' },
    { icon: FlagIcon, label: 'Open Reports', value: fmt(stats.reports.open), hint: `${stats.reports.total} total reports`, tone: 'red' },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-extrabold text-ink">Overview</h2>
          <p className="mt-1 text-sm text-muted">A quick snapshot of your Bideo platform.</p>
        </div>
        {stats.reports.open > 0 && (
          <Link
            to="/admin/reports"
            className="inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100"
          >
            <FlagIcon className="h-4 w-4" /> {stats.reports.open} reports need review
          </Link>
        )}
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Recent videos */}
        <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold text-ink">Recent Videos</h3>
            <Link to="/admin/videos" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
              View all <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {stats.recentVideos.length === 0 && (
              <p className="text-sm text-muted">No videos yet.</p>
            )}
            {stats.recentVideos.map((v) => (
              <div key={v._id} className="flex items-center gap-3">
                <img
                  src={v.thumbnail}
                  alt=""
                  className="h-12 w-20 shrink-0 rounded-lg bg-surface object-cover"
                  onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{v.title || 'Untitled'}</p>
                  <p className="truncate text-xs text-muted">
                    {v.owner?.channelName || v.owner?.name || 'Unknown'} · {fmt(v.views)} views
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-xs capitalize text-muted">
                  {v.visibility || 'public'}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Recent users */}
        <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold text-ink">Recent Users</h3>
            <Link to="/admin/users" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
              View all <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {stats.recentUsers.length === 0 && (
              <p className="text-sm text-muted">No users yet.</p>
            )}
            {stats.recentUsers.map((u) => (
              <div key={u._id} className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand">
                  {(u.name || '?').charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{u.name || 'Unnamed'}</p>
                  <p className="truncate text-xs text-muted">{u.email || u.phone || '—'}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${u.role === 'admin' ? 'bg-brand-50 text-brand' : 'bg-surface text-muted'}`}>
                  {u.role}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default DashboardHome;
