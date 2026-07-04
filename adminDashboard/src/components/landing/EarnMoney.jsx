import {
  UploadIcon,
  EyeIcon,
  GiftIcon,
  UsersIcon,
  TrendingUpIcon,
  SparkIcon,
} from "../Icons";

const creatorPerks = [
  { icon: TrendingUpIcon, text: "Planned creator eligibility criteria" },
  { icon: UsersIcon, text: "Audience and channel growth tools" },
  { icon: GiftIcon, text: "Future monetization features for eligible creators" },
];

const platformPerks = [
  { icon: EyeIcon, text: "Advertiser-friendly content standards" },
  { icon: SparkIcon, text: "Reporting and moderation workflows" },
  { icon: UsersIcon, text: "Community guidelines for all users" },
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
          <SparkIcon className="h-4 w-4" /> For creators
        </span>
        <h2 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Build a channel with responsible creator tools
        </h2>
        <p className="mt-4 text-lg text-muted">
          Bideo is designed for creators who want to publish original videos,
          build an audience, and follow clear platform standards. Monetization
          features are planned for eligible creators in the future.
        </p>
      </div>

      <div className="mt-14 flex flex-col gap-6 lg:flex-row">
        <EarnCard
          tone="creator"
          icon={UploadIcon}
          kicker="Creator growth"
          title="Publish original content"
          desc="Create a channel, upload videos or shorts, and build your audience over time. Results depend on content quality, consistency, audience interest, and platform rules."
          perks={creatorPerks}
        />
        <EarnCard
          tone="viewer"
          icon={EyeIcon}
          kicker="Platform safety"
          title="Designed for trust"
          desc="Bideo uses content rules, reporting tools, and moderation practices to support a safer experience for viewers, creators, advertisers, and partners."
          perks={platformPerks}
        />
      </div>

      <p className="reveal mt-8 text-center text-sm text-muted">
        Monetization is under development and is not guaranteed. Future access may depend on
        eligibility, policy compliance, location, review status, and applicable program terms.
      </p>
    </div>
  </section>
);

export default EarnMoney;
