// Small presentational pieces shared by the user profile tabs.

const BADGE_TONES = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
  blue: "bg-sky-50 text-sky-700 border-sky-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
  brand: "bg-brand-50 text-brand border-brand/20",
  gray: "bg-slate-100 text-slate-700 border-slate-200",
};

export const Badge = ({ tone = "gray", children, className = "" }) => (
  <span
    className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${BADGE_TONES[tone] || BADGE_TONES.gray} ${className}`}
  >
    {children}
  </span>
);

const STATUS_TONES = {
  public: "green",
  unlisted: "amber",
  private: "gray",
  open: "amber",
  reviewed: "blue",
  actioned: "red",
  dismissed: "gray",
  pending: "amber",
  credited: "green",
  approved: "green",
  passed: "green",
  active: "green",
  completed: "blue",
  queued: "violet",
  accepted: "green",
  cancelled: "gray",
  rejected: "red",
  failed: "red",
  blocked: "red",
  expired: "gray",
};

export const StatusBadge = ({ status }) =>
  status ? <Badge tone={STATUS_TONES[status] || "gray"}>{String(status).replace(/_/g, " ")}</Badge> : null;

export const EmptyState = ({ icon = "📭", title, hint }) => (
  <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center">
    <div className="text-3xl" aria-hidden="true">{icon}</div>
    <p className="mt-3 font-display text-sm font-bold text-ink">{title}</p>
    {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
  </div>
);

export const ErrorState = ({ message, onRetry }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
    <span>{message}</span>
    {onRetry && (
      <button type="button" onClick={onRetry} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-red-700 border border-red-200 hover:bg-red-100">
        Try again
      </button>
    )}
  </div>
);

/** Segmented pills used for sub-views (e.g. Wallet credits / Coins / Payouts). */
export const PillGroup = ({ options, value, onChange, label }) => (
  <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label={label}>
    {options.map((o) => {
      const selected = value === o.value;
      return (
        <button
          key={o.value || "all"}
          type="button"
          role="tab"
          aria-selected={selected}
          onClick={() => onChange(o.value)}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
            selected ? "bg-brand text-white shadow-sm" : "bg-white text-ink/70 border border-line hover:bg-surface hover:text-ink"
          }`}
        >
          {o.label}
          {o.count !== undefined && (
            <span className={`rounded-full px-1.5 text-[10px] font-bold ${selected ? "bg-white/25 text-white" : "bg-surface text-muted border border-line"}`}>
              {o.count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

export const SortSelect = ({ options, value, onChange }) => (
  <label className="inline-flex items-center gap-2 text-xs font-semibold text-muted">
    Sort
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </label>
);

/** White card that wraps a table and scrolls horizontally on small screens. */
export const TableCard = ({ children, minWidth = "min-w-[720px]" }) => (
  <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card min-w-0">
    <div className="overflow-x-auto">
      <table className={`w-full ${minWidth} text-sm`}>{children}</table>
    </div>
  </div>
);

export const Th = ({ children, className = "" }) => (
  <th className={`p-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted ${className}`}>{children}</th>
);

export const Td = ({ children, className = "" }) => <td className={`p-3.5 align-top ${className}`}>{children}</td>;
