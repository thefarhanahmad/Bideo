
const tones = {
  brand: "bg-brand-50 text-brand",
  green: "bg-emerald-50 text-emerald-600",
  blue: "bg-sky-50 text-sky-600",
  red: "bg-red-50 text-red-600",
  violet: "bg-violet-50 text-violet-600",
  amber: "bg-amber-50 text-amber-600",
};

const StatCard = ({ icon: Icon, label, value, hint, tone = "brand", badge, highlight }) => (
  <div className="rounded-2xl border border-line bg-white p-3.5 sm:p-5 shadow-card transition-all hover:-translate-y-1 flex flex-col justify-between">
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs sm:text-sm font-semibold text-muted truncate">{label}</span>
        <span className={`grid h-8 w-8 sm:h-10 sm:w-10 shrink-0 place-items-center rounded-xl ${tones[tone] || tones.brand}`}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </span>
      </div>
      <div className="mt-2 sm:mt-3 font-display text-xl sm:text-2xl xl:text-3xl font-extrabold text-ink tracking-tight flex items-baseline gap-2 flex-wrap">
        <span>{value}</span>
        {badge}
      </div>
    </div>
    {highlight ? (
      <div className="mt-2">{highlight}</div>
    ) : hint ? (
      <div className="mt-1 text-[11px] sm:text-xs text-muted truncate">{hint}</div>
    ) : null}
  </div>
);

export default StatCard;
