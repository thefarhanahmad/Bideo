import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ProfileHeader from "../components/userProfile/ProfileHeader";
import ProfileStats from "../components/userProfile/ProfileStats";
import TabPanel from "../components/userProfile/TabPanel";
import { PROFILE_TABS, findTab } from "../components/userProfile/profileTabs";
import { ErrorState } from "../components/userProfile/ui";
import { CardSkeleton, ShimmerBar } from "../components/LoadingSkeleton";
import { useUserActions } from "../hooks/useUserActions";
import { useProfileParams } from "../hooks/useProfileTab";
import { adminFetch, isAbortError } from "../lib/adminApi";
import { formatCompact } from "../lib/format";

const HeaderSkeleton = () => (
  <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
    <ShimmerBar className="h-28 sm:h-40 w-full rounded-none" />
    <div className="space-y-3 px-6 pb-6">
      <ShimmerBar className="-mt-12 h-24 w-24 rounded-full ring-4 ring-white" />
      <ShimmerBar className="h-6 w-56" />
      <ShimmerBar className="h-4 w-32" />
      <ShimmerBar className="h-4 w-full max-w-xl" />
    </div>
  </div>
);

/** Admin view of everything about one user: header, stats and lazy-loaded tabs. */
const UserProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, update] = useProfileParams(PROFILE_TABS[0].key);
  const [overview, setOverview] = useState({ loading: true, error: null, data: null });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setOverview((o) => ({ ...o, loading: true, error: null }));
    adminFetch(`/api/admin/users/${id}/overview`, { signal: controller.signal })
      .then((res) => setOverview({ loading: false, error: null, data: res.data }))
      .catch((err) => !isAbortError(err) && setOverview({ loading: false, error: err.message, data: null }));
    return () => controller.abort();
  }, [id, reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);
  const { actions, dialogs } = useUserActions({
    onChanged: refresh,
    onDeleted: () => navigate("/admin/users", { replace: true }),
  });

  const activeTab = findTab(params.tab);
  const data = overview.data;

  return (
    <div className="space-y-5 min-w-0 max-w-full">
      <div className="flex items-center gap-2.5 text-xs font-semibold text-muted">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/admin/users"))}
          className="inline-flex items-center gap-1 hover:text-brand transition-colors cursor-pointer"
        >
          ← Back
        </button>
        <span className="text-line">|</span>
        <Link to="/admin/users" className="hover:text-brand transition-colors">
          All Users
        </Link>
        <span className="text-line">|</span>
        <Link to="/admin/earnings" className="hover:text-brand transition-colors">
          Earnings
        </Link>
      </div>

      {overview.error && !data ? (
        <ErrorState message={overview.error} onRetry={refresh} />
      ) : !data ? (
        <>
          <HeaderSkeleton />
          <CardSkeleton count={4} />
        </>
      ) : (
        <>
          <ProfileHeader user={data.user} monetization={data.monetization} stats={data.stats} actions={actions} />
          <ProfileStats user={data.user} stats={data.stats} />

          <nav
            id="profile-tabs"
            aria-label="Profile sections"
            className="scroll-mt-20 overflow-x-auto rounded-2xl border border-line bg-white shadow-card"
          >
            <div className="flex min-w-max gap-1 p-1.5 lg:min-w-0 lg:flex-wrap">
              {PROFILE_TABS.map((t) => {
                const selected = t.key === activeTab.key;
                const count = t.count ? t.count(data.stats) : undefined;
                return (
                  <button
                    key={t.key}
                    type="button"
                    aria-current={selected ? "page" : undefined}
                    onClick={() => !selected && update({ tab: t.key })}
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                      selected ? "bg-brand text-white shadow-sm" : "text-ink/70 hover:bg-surface hover:text-ink"
                    }`}
                  >
                    {t.label}
                    {count !== undefined && (
                      <span className={`rounded-full px-1.5 text-[10px] font-bold ${selected ? "bg-white/25 text-white" : "bg-surface text-muted border border-line"}`}>
                        {formatCompact(count)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>

          <TabPanel key={`${id}-${activeTab.key}`} tab={activeTab} userId={id} stats={data.stats} params={params} update={update} />
        </>
      )}

      {dialogs}
    </div>
  );
};

export default UserProfile;
