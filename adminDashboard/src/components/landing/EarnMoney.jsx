import {
  UploadIcon,
  EyeIcon,
  CashIcon,
  GiftIcon,
  UsersIcon,
  TrendingUpIcon,
  SparkIcon,
} from "../Icons";

const creatorPerks = [
  { icon: TrendingUpIcon, text: "Ad revenue share on your videos" },
  { icon: UsersIcon, text: "Channel memberships from your fans" },
  { icon: GiftIcon, text: "Tips & Super Chats from viewers" },
];

const viewerPerks = [
  { icon: CashIcon, text: "Watch-to-earn reward points" },
  { icon: SparkIcon, text: "Daily streaks & engagement bonuses" },
  { icon: UsersIcon, text: "Refer friends and earn together" },
];

const EarnCard = ({ tone, icon: Icon, kicker, title, desc, perks }) => (
  <div className="reveal flex-1 overflow-hidden rounded-3xl border border-line bg-white shadow-card">
    <div
      className={`flex items-center gap-3 px-7 py-6 ${
        tone === "creator"
          ? "bg-gradient-to-r from-brand-dark to-brand"
          : "bg-ink"
      }`}
    >
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/20">
        <Icon className="h-6 w-6 text-white" />
      </span>
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-white/80">
          {kicker}
        </div>
        <div className="font-display text-xl font-extrabold text-white">
          {title}
        </div>
      </div>
    </div>
    <div className="px-7 py-6">
      <p className="text-muted">{desc}</p>
      <ul className="mt-5 space-y-3.5">
        {perks.map((p) => (
          <li key={p.text} className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand">
              <p.icon className="h-4 w-4" />
            </span>
            <span className="font-medium text-ink">{p.text}</span>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

const EarnMoney = () => (
  <section id="earn" className="bg-surface py-20 sm:py-28">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="reveal mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-white px-4 py-1.5 text-sm font-semibold text-brand shadow-sm">
          <CashIcon className="h-4 w-4" /> Monetization
        </span>
        <h2 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Get paid to create — and to watch
        </h2>
        <p className="mt-4 text-lg text-muted">
          On Bideo your time is rewarded. Creators earn from their content and
          viewers earn just for watching and engaging. Everyone wins.
        </p>
      </div>

      <div className="mt-14 flex flex-col gap-6 lg:flex-row">
        <EarnCard
          tone="creator"
          icon={UploadIcon}
          kicker="For creators"
          title="Earn by uploading"
          desc="Turn your videos and shorts into income. The more you create and grow, the more you earn."
          perks={creatorPerks}
        />
        <EarnCard
          tone="viewer"
          icon={EyeIcon}
          kicker="For viewers"
          title="Earn by watching"
          desc="Get rewarded for the time you already spend watching. Collect points and redeem perks."
          perks={viewerPerks}
        />
      </div>

      <p className="reveal mt-8 text-center text-sm text-muted">
        💡 Monetization &amp; the secure payment gateway are rolling out soon —
        start building your audience today so you're ready on day one.
      </p>
    </div>
  </section>
);

export default EarnMoney;
