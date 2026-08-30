import React from "react";

/**
 * Reusable Shimmer Skeleton component for the Admin Dashboard.
 * Supports types: "table", "cards", "charts", "grid", "details"
 */
export const ShimmerBar = ({ className = "h-4 w-full" }) => (
  <div className={`shimmer-effect rounded-lg ${className}`} />
);

export const TableSkeleton = ({ rows = 6, cols = 6 }) => {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card min-w-0 animate-fade-up">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface/60">
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="p-4">
                  <div className="shimmer-effect h-3.5 w-24 rounded" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex} className="border-t border-line">
                {/* Column 1: Avatar + Name / Title */}
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="shimmer-effect h-10 w-10 shrink-0 rounded-full" />
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="shimmer-effect h-3.5 w-3/4 rounded" />
                      <div className="shimmer-effect h-2.5 w-1/2 rounded" />
                    </div>
                  </div>
                </td>

                {/* Column 2 */}
                <td className="p-4">
                  <div className="space-y-1.5">
                    <div className="shimmer-effect h-3.5 w-28 rounded" />
                    <div className="shimmer-effect h-2.5 w-20 rounded" />
                  </div>
                </td>

                {/* Column 3 */}
                <td className="p-4">
                  <div className="shimmer-effect h-4 w-24 rounded" />
                </td>

                {/* Column 4 */}
                <td className="p-4">
                  <div className="shimmer-effect h-5 w-20 rounded-full" />
                </td>

                {/* Column 5 */}
                {cols >= 5 && (
                  <td className="p-4">
                    <div className="shimmer-effect h-3.5 w-24 rounded" />
                  </td>
                )}

                {/* Column 6: Action buttons */}
                {cols >= 6 && (
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <div className="shimmer-effect h-8 w-16 rounded-xl" />
                      <div className="shimmer-effect h-8 w-16 rounded-xl" />
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const CardSkeleton = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-2 gap-3.5 sm:gap-5 md:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="relative overflow-hidden rounded-2xl border border-line bg-white p-5 shadow-card"
        >
          <div className="flex items-center justify-between">
            <div className="shimmer-effect h-4 w-24 rounded" />
            <div className="shimmer-effect h-10 w-10 rounded-xl" />
          </div>
          <div className="mt-4 space-y-2">
            <div className="shimmer-effect h-7 w-20 rounded" />
            <div className="shimmer-effect h-3 w-32 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const ChartSkeleton = () => {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white p-6 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div className="space-y-1.5">
          <div className="shimmer-effect h-5 w-40 rounded" />
          <div className="shimmer-effect h-3 w-64 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="shimmer-effect h-8 w-20 rounded-xl" />
          <div className="shimmer-effect h-8 w-20 rounded-xl" />
        </div>
      </div>
      <div className="mt-6 flex h-64 items-end gap-3 pt-8">
        {Array.from({ length: 12 }).map((_, i) => {
          const heightPercent = [35, 60, 45, 80, 55, 90, 70, 85, 40, 65, 75, 50][i % 12];
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <div
                className="shimmer-effect w-full rounded-t-lg"
                style={{ height: `${heightPercent}%` }}
              />
              <div className="shimmer-effect h-2.5 w-6 rounded" />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const VideoGridSkeleton = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-line bg-white shadow-card"
        >
          <div className="shimmer-effect aspect-video w-full" />
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="shimmer-effect h-9 w-9 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5 min-w-0">
                <div className="shimmer-effect h-4 w-3/4 rounded" />
                <div className="shimmer-effect h-3 w-1/2 rounded" />
              </div>
            </div>
            <div className="flex justify-between pt-2 border-t border-line/60">
              <div className="shimmer-effect h-3 w-16 rounded" />
              <div className="shimmer-effect h-3 w-20 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default function LoadingSkeleton({ type = "table", count, rows, cols }) {
  if (type === "cards") return <CardSkeleton count={count} />;
  if (type === "charts") return <ChartSkeleton />;
  if (type === "grid") return <VideoGridSkeleton count={count} />;
  return <TableSkeleton rows={rows} cols={cols} />;
}
