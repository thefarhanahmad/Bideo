import { useState } from "react";

// Helper to generate smooth SVG path from data points
const getSvgPath = (points, width, height, padding = 30) => {
  if (!points || points.length === 0) return { path: "", areaPath: "", coords: [] };

  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  const maxVal = Math.max(...points.map((p) => p.value), 1);
  const minVal = 0;

  const coords = points.map((p, index) => {
    const x = padding + (index / Math.max(points.length - 1, 1)) * usableWidth;
    const y = height - padding - ((p.value - minVal) / (maxVal - minVal)) * usableHeight;
    return { x, y, ...p };
  });

  if (coords.length === 1) {
    const single = coords[0];
    return {
      path: `M ${padding} ${single.y} L ${width - padding} ${single.y}`,
      areaPath: `M ${padding} ${single.y} L ${width - padding} ${single.y} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`,
      coords,
      maxVal,
    };
  }

  // Generate smooth cubic bezier curve
  let d = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const current = coords[i];
    const next = coords[i + 1];
    const controlX = (current.x + next.x) / 2;
    d += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
  }

  const last = coords[coords.length - 1];
  const first = coords[0];
  const areaD = `${d} L ${last.x} ${height - padding} L ${first.x} ${height - padding} Z`;

  return { path: d, areaPath: areaD, coords, maxVal };
};

// 1. User Signups Area Chart
export const UserGrowthChart = ({ data }) => {
  const [timeframe, setTimeframe] = useState("daily"); // daily, weekly, monthly
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const series = (data && data[timeframe]) || [];
  const points = series.map((item) => ({
    label: item.label,
    value: item.count || 0,
    sub: item.date || "",
  }));

  const totalInPeriod = points.reduce((sum, p) => sum + p.value, 0);

  const svgWidth = 500;
  const svgHeight = 220;
  const { path, areaPath, coords, maxVal } = getSvgPath(points, svgWidth, svgHeight, 35);

  return (
    <div className="rounded-2xl border border-line bg-white p-3.5 sm:p-5 shadow-card flex flex-col justify-between min-w-0 max-w-full overflow-hidden w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-line min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full bg-brand" />
            <h3 className="font-display font-bold text-ink text-sm sm:text-base truncate">User Registrations</h3>
          </div>
          <p className="text-[11px] sm:text-xs text-muted mt-0.5 truncate">
            Total in period: <strong className="text-ink font-semibold">{totalInPeriod} new users</strong>
          </p>
        </div>

        {/* Timeframe selector */}
        <div className="flex rounded-lg bg-surface p-0.5 sm:p-1 border border-line text-[11px] sm:text-xs font-semibold shrink-0 self-start sm:self-auto">
          {["daily", "weekly", "monthly"].map((t) => (
            <button
              key={t}
              onClick={() => {
                setTimeframe(t);
                setHoveredPoint(null);
              }}
              className={`rounded-md px-2 sm:px-2.5 py-0.5 sm:py-1 uppercase tracking-wider transition-colors ${
                timeframe === t ? "bg-white text-brand shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Chart Area */}
      <div className="relative mt-3 w-full h-[200px] sm:h-[220px] overflow-hidden min-w-0">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8E24AA" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#8E24AA" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Background Grid Lines */}
          {[0, 0.33, 0.66, 1].map((ratio, idx) => {
            const y = 35 + ratio * (svgHeight - 70);
            return (
              <g key={idx}>
                <line x1="30" y1={y} x2={svgWidth - 30} y2={y} stroke="#F0F0F0" strokeDasharray="3 3" />
                <text x="25" y={y + 3} textAnchor="end" fontSize="9" fill="#AAA">
                  {Math.round((maxVal || 1) * (1 - ratio))}
                </text>
              </g>
            );
          })}

          {/* Area Fill */}
          {areaPath && <path d={areaPath} fill="url(#userGrad)" />}

          {/* Smooth Line */}
          {path && (
            <path
              d={path}
              fill="none"
              stroke="#8E24AA"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data Points */}
          {coords.map((c, i) => (
            <g key={i}>
              <circle
                cx={c.x}
                cy={c.y}
                r={hoveredPoint?.index === i ? 6 : 3.5}
                fill="#FFF"
                stroke="#8E24AA"
                strokeWidth={hoveredPoint?.index === i ? 3 : 2}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoveredPoint({ ...c, index: i })}
                onMouseLeave={() => setHoveredPoint(null)}
                onClick={() => setHoveredPoint(hoveredPoint?.index === i ? null : { ...c, index: i })}
              />
              {/* X-axis labels */}
              {(coords.length <= 8 || i % 2 === 0 || i === coords.length - 1) && (
                <text
                  x={c.x}
                  y={svgHeight - 10}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#888"
                  fontWeight="500"
                >
                  {c.label}
                </text>
              )}
            </g>
          ))}
        </svg>

        {/* Hover Tooltip */}
        {hoveredPoint && (
          <div
            className="pointer-events-none absolute top-1 rounded-lg bg-ink px-2.5 py-1.5 text-white shadow-lg text-xs z-10"
            style={{
              left: `${Math.min(Math.max(12, (hoveredPoint.x / svgWidth) * 100), 88)}%`,
              transform: "translateX(-50%)",
            }}
          >
            <div className="font-bold text-amber-400">{hoveredPoint.value} Users</div>
            <div className="text-[10px] text-white/80">{hoveredPoint.sub || hoveredPoint.label}</div>
          </div>
        )}
      </div>
    </div>
  );
};

// 2. User Segmentation & Status Breakdown Chart
export const UserSegmentationChart = ({ usersData }) => {
  const total = usersData?.total || 1;
  const monetized = usersData?.monetized || 0;
  const regular = usersData?.regular || 0;
  const admins = usersData?.admins || 0;
  const scheduledDeletions = usersData?.scheduledDeletions || 0;

  const items = [
    { label: "Monetized Creators", count: monetized, color: "bg-emerald-500", text: "text-emerald-700" },
    { label: "Regular Creators / Users", count: regular, color: "bg-brand", text: "text-brand" },
    { label: "Admins & Staff", count: admins, color: "bg-blue-500", text: "text-blue-700" },
    { label: "Deletion Scheduled", count: scheduledDeletions, color: "bg-red-500", text: "text-red-700" },
  ];

  return (
    <div className="rounded-2xl border border-line bg-white p-3.5 sm:p-5 shadow-card flex flex-col justify-between min-w-0 max-w-full overflow-hidden w-full">
      <div className="flex items-center justify-between pb-3 border-b border-line min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-3 w-3 shrink-0 rounded-full bg-emerald-500" />
          <h3 className="font-display font-bold text-ink text-sm sm:text-base truncate">User Segmentation</h3>
        </div>
        <span className="text-[11px] sm:text-xs font-semibold text-muted shrink-0">Total: {total} Users</span>
      </div>

      {/* Progress / Segment Stack Bar */}
      <div className="my-3 sm:my-4">
        <div className="h-3.5 sm:h-4 w-full rounded-full bg-surface overflow-hidden flex">
          {items.map((item, idx) => {
            const pct = Math.max(0, (item.count / total) * 100);
            if (pct === 0) return null;
            return (
              <div
                key={idx}
                style={{ width: `${pct}%` }}
                className={`${item.color} h-full transition-all`}
                title={`${item.label}: ${item.count} (${pct.toFixed(1)}%)`}
              />
            );
          })}
        </div>
      </div>

      {/* Detail breakdown list */}
      <div className="space-y-2">
        {items.map((item, idx) => {
          const pct = ((item.count / total) * 100).toFixed(1);
          return (
            <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-line/50 last:border-0 min-w-0">
              <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.color}`} />
                <span className="font-medium text-ink truncate text-[11px] sm:text-xs">{item.label}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <strong className={`font-bold ${item.text} text-[11px] sm:text-xs`}>{item.count}</strong>
                <span className="text-muted w-11 text-right text-[10px] sm:text-xs">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 3. Video Uploads & Formats Trend Chart (Dual Series)
export const VideoUploadsChart = ({ data }) => {
  const [timeframe, setTimeframe] = useState("daily");
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const series = (data && data[timeframe]) || [];
  const points = series.map((item) => ({
    label: item.label,
    value: item.total || 0,
    longVideos: item.longVideos || 0,
    shorts: item.shorts || 0,
    views: item.views || 0,
    sub: item.date || "",
  }));

  const totalUploaded = points.reduce((sum, p) => sum + p.value, 0);
  const totalLong = points.reduce((sum, p) => sum + p.longVideos, 0);
  const totalShorts = points.reduce((sum, p) => sum + p.shorts, 0);

  const svgWidth = 500;
  const svgHeight = 220;
  const { path, areaPath, coords, maxVal } = getSvgPath(points, svgWidth, svgHeight, 35);

  return (
    <div className="rounded-2xl border border-line bg-white p-3.5 sm:p-5 shadow-card flex flex-col justify-between min-w-0 max-w-full overflow-hidden w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-line min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full bg-blue-600" />
            <h3 className="font-display font-bold text-ink text-sm sm:text-base truncate">Video Publishing Trends</h3>
          </div>
          <p className="text-[11px] sm:text-xs text-muted mt-0.5 truncate">
            Total uploaded: <strong className="text-ink font-semibold">{totalUploaded} videos</strong> ({totalLong} Long, {totalShorts} Shorts)
          </p>
        </div>

        {/* Timeframe selector */}
        <div className="flex rounded-lg bg-surface p-0.5 sm:p-1 border border-line text-[11px] sm:text-xs font-semibold shrink-0 self-start sm:self-auto">
          {["daily", "weekly", "monthly"].map((t) => (
            <button
              key={t}
              onClick={() => {
                setTimeframe(t);
                setHoveredPoint(null);
              }}
              className={`rounded-md px-2 sm:px-2.5 py-0.5 sm:py-1 uppercase tracking-wider transition-colors ${
                timeframe === t ? "bg-white text-blue-600 shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Chart Area */}
      <div className="relative mt-3 w-full h-[200px] sm:h-[220px] overflow-hidden min-w-0">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="vidGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid Lines */}
          {[0, 0.33, 0.66, 1].map((ratio, idx) => {
            const y = 35 + ratio * (svgHeight - 70);
            return (
              <g key={idx}>
                <line x1="30" y1={y} x2={svgWidth - 30} y2={y} stroke="#F0F0F0" strokeDasharray="3 3" />
                <text x="25" y={y + 3} textAnchor="end" fontSize="9" fill="#AAA">
                  {Math.round((maxVal || 1) * (1 - ratio))}
                </text>
              </g>
            );
          })}

          {/* Area Fill */}
          {areaPath && <path d={areaPath} fill="url(#vidGrad)" />}

          {/* Line */}
          {path && (
            <path
              d={path}
              fill="none"
              stroke="#2563EB"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Points */}
          {coords.map((c, i) => (
            <g key={i}>
              <circle
                cx={c.x}
                cy={c.y}
                r={hoveredPoint?.index === i ? 6 : 3.5}
                fill="#FFF"
                stroke="#2563EB"
                strokeWidth={hoveredPoint?.index === i ? 3 : 2}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoveredPoint({ ...c, index: i })}
                onMouseLeave={() => setHoveredPoint(null)}
                onClick={() => setHoveredPoint(hoveredPoint?.index === i ? null : { ...c, index: i })}
              />
              {(coords.length <= 8 || i % 2 === 0 || i === coords.length - 1) && (
                <text
                  x={c.x}
                  y={svgHeight - 10}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#888"
                  fontWeight="500"
                >
                  {c.label}
                </text>
              )}
            </g>
          ))}
        </svg>

        {/* Hover Tooltip */}
        {hoveredPoint && (
          <div
            className="pointer-events-none absolute top-1 rounded-lg bg-ink px-2.5 py-1.5 text-white shadow-lg text-xs z-10"
            style={{
              left: `${Math.min(Math.max(12, (hoveredPoint.x / svgWidth) * 100), 88)}%`,
              transform: "translateX(-50%)",
            }}
          >
            <div className="font-bold text-blue-300">{hoveredPoint.value} Total Videos</div>
            <div className="text-[10px] text-white/90 mt-0.5">
              📹 {hoveredPoint.longVideos} Long • ⚡ {hoveredPoint.shorts} Shorts
            </div>
            <div className="text-[9px] text-white/70">{hoveredPoint.sub || hoveredPoint.label}</div>
          </div>
        )}
      </div>
    </div>
  );
};

// 4. Video Formats & Views Distribution
export const VideoFormatsChart = ({ videosData, totalViews, avgViews }) => {
  const total = videosData?.total || 1;
  const longVideos = videosData?.longVideos || 0;
  const shorts = videosData?.shorts || 0;
  const publicVids = videosData?.public || 0;
  const privateVids = (videosData?.private || 0) + (videosData?.unlisted || 0);

  const formatStats = [
    { label: "Long Form Videos", count: longVideos, pct: ((longVideos / total) * 100).toFixed(1), color: "bg-blue-500", text: "text-blue-700" },
    { label: "Shorts (Reels)", count: shorts, pct: ((shorts / total) * 100).toFixed(1), color: "bg-amber-500", text: "text-amber-700" },
    { label: "Public Videos", count: publicVids, pct: ((publicVids / total) * 100).toFixed(1), color: "bg-emerald-500", text: "text-emerald-700" },
    { label: "Private / Unlisted", count: privateVids, pct: ((privateVids / total) * 100).toFixed(1), color: "bg-gray-400", text: "text-gray-700" },
  ];

  return (
    <div className="rounded-2xl border border-line bg-white p-3.5 sm:p-5 shadow-card flex flex-col justify-between min-w-0 max-w-full overflow-hidden w-full">
      <div className="flex items-center justify-between pb-3 border-b border-line min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-3 w-3 shrink-0 rounded-full bg-violet-500" />
          <h3 className="font-display font-bold text-ink text-sm sm:text-base truncate">Content & Views Distribution</h3>
        </div>
        <span className="text-[11px] sm:text-xs font-semibold text-muted shrink-0">Total: {total} Videos</span>
      </div>

      {/* Top 2 View Highlights */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 my-2.5 sm:my-3">
        <div className="rounded-xl border border-line bg-surface/40 p-2.5 sm:p-3 min-w-0">
          <span className="text-[10px] sm:text-[11px] font-semibold text-muted uppercase truncate block">Total Views</span>
          <div className="font-display text-base sm:text-lg font-bold text-ink mt-0.5 truncate">
            {Number(totalViews || 0).toLocaleString("en-IN")}
          </div>
        </div>
        <div className="rounded-xl border border-line bg-surface/40 p-2.5 sm:p-3 min-w-0">
          <span className="text-[10px] sm:text-[11px] font-semibold text-muted uppercase truncate block">Avg Views / Video</span>
          <div className="font-display text-base sm:text-lg font-bold text-violet-700 mt-0.5 truncate">
            {Number(avgViews || 0).toLocaleString("en-IN")}
          </div>
        </div>
      </div>

      {/* Progress Stack */}
      <div className="mb-2.5 sm:mb-3">
        <div className="h-3.5 sm:h-4 w-full rounded-full bg-surface overflow-hidden flex">
          <div style={{ width: `${(longVideos / total) * 100}%` }} className="bg-blue-500 h-full" title={`Long: ${longVideos}`} />
          <div style={{ width: `${(shorts / total) * 100}%` }} className="bg-amber-500 h-full" title={`Shorts: ${shorts}`} />
        </div>
      </div>

      {/* Format list */}
      <div className="space-y-1.5 sm:space-y-2">
        {formatStats.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between text-xs py-0.5 border-b border-line/40 last:border-0 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.color}`} />
              <span className="font-medium text-ink truncate text-[11px] sm:text-xs">{item.label}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <strong className={`font-bold ${item.text} text-[11px] sm:text-xs`}>{item.count}</strong>
              <span className="text-muted w-11 text-right text-[10px] sm:text-xs">{item.pct}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
