import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../config';
import StatCard from '../components/StatCard';
import { UsersIcon, PlayIcon, TagIcon, FlagIcon, EyeIcon, ArrowRightIcon } from '../components/Icons';
import {
  UserGrowthChart,
  UserSegmentationChart,
  VideoUploadsChart,
  VideoFormatsChart,
} from '../components/AnalyticsCharts';

const resolveMediaUrl = (url) => {
  if (!url) return "https://via.placeholder.com/640x360.png?text=No+Thumbnail";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

const fmtExact = (n) => {
  const num = Number(n) || 0;
  return num.toLocaleString('en-IN');
};

const fmt = fmtExact;

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
        <div className="mt-6 grid grid-cols-2 gap-3.5 sm:gap-5 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
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

  if (!stats) {
    return (
      <div className="rounded-2xl border border-line bg-white p-8 text-center text-muted">
        No stats available.
      </div>
    );
  }

  const cards = [
    {
      icon: UsersIcon,
      label: 'Total Users',
      value: fmtExact(stats.users?.total),
      hint: `${fmtExact(stats.users?.admins || 0)} admins · ${fmtExact(stats.users?.monetized || 0)} monetized`,
      tone: 'brand',
    },
    {
      icon: PlayIcon,
      label: 'Videos',
      value: fmtExact(stats.videos?.total),
      hint: `${fmtExact(stats.videos?.longVideos || 0)} long · ${fmtExact(stats.videos?.shorts || 0)} shorts`,
      tone: 'blue',
    },
    {
      icon: EyeIcon,
      label: 'Total Views',
      value: fmtExact(stats.totalViews),
      hint: `${fmtExact(Math.round(stats.avgViewsPerVideo || 0))} avg / video`,
      tone: 'violet',
    },
    {
      icon: TagIcon,
      label: 'Categories',
      value: fmtExact(stats.categories?.total),
      hint: 'content categories',
      tone: 'green',
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 min-w-0 max-w-full overflow-hidden">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink truncate">Overview & Analytics</h2>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted">A live snapshot of user growth, video publishing, and audience reach.</p>
        </div>
        {(stats.reports?.open || 0) > 0 && (
          <Link
            to="/admin/reports"
            className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 shrink-0"
          >
            <FlagIcon className="h-4 w-4" /> {stats.reports.open} reports need review
          </Link>
        )}
      </div>

      {/* Top Stat Cards (2-col on mobile, 4 in a single row on desktop) */}
      <div className="grid grid-cols-2 gap-3.5 sm:gap-5 md:grid-cols-4 min-w-0 max-w-full">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      {/* Row 1: Users Analytics (2 charts side-by-side) */}
      <div className="space-y-3 min-w-0 max-w-full">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-display text-base sm:text-lg font-extrabold text-ink">Users Analytics</h3>
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand">Live DB Sync</span>
        </div>
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2 min-w-0 max-w-full">
          <UserGrowthChart data={stats.userTrends} />
          <UserSegmentationChart usersData={stats.users} />
        </div>
      </div>

      {/* Row 2: Videos Analytics (2 charts side-by-side) */}
      <div className="space-y-3 min-w-0 max-w-full">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-display text-base sm:text-lg font-extrabold text-ink">Videos & Reach Analytics</h3>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">Live DB Sync</span>
        </div>
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2 min-w-0 max-w-full">
          <VideoUploadsChart data={stats.videoTrends} />
          <VideoFormatsChart
            videosData={stats.videos}
            totalViews={stats.totalViews}
            avgViews={stats.avgViewsPerVideo}
          />
        </div>
      </div>

      {/* Row 3: Recent Activity */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2 min-w-0 max-w-full">
        {/* Recent videos */}
        <section className="rounded-2xl border border-line bg-white p-3.5 sm:p-5 shadow-card min-w-0 max-w-full overflow-hidden">
          <div className="flex items-center justify-between min-w-0 pb-2 border-b border-line/60">
            <h3 className="font-display text-sm sm:text-base font-bold text-ink truncate">Recent Videos</h3>
            <Link to="/admin/videos" className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-brand hover:underline shrink-0">
              View all <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-3.5 space-y-3 min-w-0">
            {stats.recentVideos.length === 0 && (
              <p className="text-sm text-muted">No videos yet.</p>
            )}
            {stats.recentVideos.map((v) => (
              <div key={v._id} className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <img
                  src={resolveMediaUrl(v.thumbnail)}
                  alt=""
                  className="h-11 w-16 sm:h-12 sm:w-20 shrink-0 rounded-lg bg-surface object-cover border border-line"
                  onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/640x360.png?text=Thumbnail'; }}
                />
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="truncate text-xs sm:text-sm font-semibold text-ink">{v.title || 'Untitled'}</p>
                  <p className="truncate text-[11px] sm:text-xs text-muted mt-0.5">
                    {v.owner?.channelName || v.owner?.name || 'Unknown'} · {fmt(v.views)} views
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10px] sm:text-xs capitalize text-muted">
                  {v.visibility || 'public'}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Recent users */}
        <section className="rounded-2xl border border-line bg-white p-3.5 sm:p-5 shadow-card min-w-0 max-w-full overflow-hidden">
          <div className="flex items-center justify-between min-w-0 pb-2 border-b border-line/60">
            <h3 className="font-display text-sm sm:text-base font-bold text-ink truncate">Recent Users</h3>
            <Link to="/admin/users" className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-brand hover:underline shrink-0">
              View all <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-3.5 space-y-3 min-w-0">
            {stats.recentUsers.length === 0 && (
              <p className="text-sm text-muted">No users yet.</p>
            )}
            {stats.recentUsers.map((u) => (
              <div key={u._id} className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <span className="grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-xs sm:text-sm font-bold text-brand">
                  {(u.name || '?').charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="truncate text-xs sm:text-sm font-semibold text-ink">{u.name || 'Unnamed'}</p>
                  <p className="truncate text-[11px] sm:text-xs text-muted mt-0.5">{u.email || u.phone || '—'}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-medium capitalize ${u.role === 'admin' ? 'bg-brand-50 text-brand' : 'bg-surface text-muted'}`}>
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
