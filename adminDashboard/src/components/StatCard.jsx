
const tones = {
  brand: "bg-brand-50 text-brand",
  green: "bg-emerald-50 text-emerald-600",
  blue: "bg-sky-50 text-sky-600",
  red: "bg-red-50 text-red-600",
  violet: "bg-violet-50 text-violet-600",
};

const StatCard = ({ icon: Icon, label, value, hint, tone = "brand" }) => (
  <div className="rounded-2xl border border-line bg-white p-5 shadow-card transition-transform hover:-translate-y-1">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-muted">{label}</span>
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </span>
    </div>
    <div className="mt-3 font-display text-3xl font-extrabold text-ink">{value}</div>
    {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
  </div>
);

export default StatCard;
