import { useMemo, useState } from "react";
import DataTableToolbar from "../DataTableToolbar";
import Pagination from "../Pagination";
import LoadingSkeleton from "../LoadingSkeleton";
import VideoPreviewModal from "../VideoPreviewModal";
import { PillGroup, SortSelect, EmptyState, ErrorState } from "./ui";
import { useProfileTab } from "../../hooks/useProfileTab";

const PAGE_SIZE = 12;
const GRID_TABS = new Set(["videos", "shorts", "posts", "stories"]);

const resolve = (value, arg) => (typeof value === "function" ? value(arg) : value);

/** Controls + data for the active profile tab. */
const TabPanel = ({ tab, userId, stats, params, update }) => {
  const [playing, setPlaying] = useState(null);
  const apiParams = useMemo(
    () => ({ ...params, tab: tab.apiTab ? tab.apiTab(params) : tab.key }),
    [params, tab]
  );
  const { data, total, pages, loading, error, reload } = useProfileTab(userId, apiParams, PAGE_SIZE);

  const views = resolve(tab.views, stats);
  const statuses = resolve(tab.statuses, params);
  const hasFilters = Boolean(params.search || params.filter || params.status);

  const skeleton = GRID_TABS.has(tab.key) || (tab.key === "activity" && params.filter !== "playlists")
    ? <LoadingSkeleton type="grid" count={8} />
    : <LoadingSkeleton type="table" rows={6} cols={5} />;

  return (
    <div className="space-y-4">
      {tab.search && (
        <DataTableToolbar
          search={params.search}
          onSearchChange={(v) => update({ search: v })}
          searchPlaceholder={tab.search}
          filter={params.filter || "all"}
          onFilterChange={(v) => update({ filter: v === "all" ? "" : v })}
          filters={tab.filters || []}
          actions={tab.sorts && <SortSelect options={tab.sorts} value={params.sort} onChange={(v) => update({ sort: v })} />}
        />
      )}

      {(views || statuses) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {views && <PillGroup label={`${tab.label} view`} options={views} value={params.filter} onChange={(v) => update({ filter: v, status: "" })} />}
          {statuses && <PillGroup label="Status" options={statuses} value={params.status} onChange={(v) => update({ status: v })} />}
        </div>
      )}

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        skeleton
      ) : data.length === 0 ? (
        <EmptyState icon={tab.empty[0]} title={hasFilters ? "Nothing matches these filters" : tab.empty[1]} hint={hasFilters ? "Try clearing the search or filters." : undefined} />
      ) : (
        tab.render({ items: data, onPlay: setPlaying, params, userId })
      )}

      {!error && (
        <Pagination
          currentPage={params.page}
          totalPages={pages}
          totalItems={total}
          pageSize={PAGE_SIZE}
          onPageChange={(p) => {
            update({ page: p });
            const bar = document.getElementById("profile-tabs");
            if (bar) bar.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      )}

      {playing && <VideoPreviewModal video={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
};

export default TabPanel;
