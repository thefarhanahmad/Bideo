import StatCard from "../StatCard";
import { UsersIcon, PlayIcon, EyeIcon, HeartIcon, WalletIcon, CoinsIcon, TrendingUpIcon, FlagIcon } from "../Icons";
import { formatCompact, formatINR, formatNumber } from "../../lib/format";

const ProfileStats = ({ user, stats }) => (
  <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
    <StatCard
      icon={UsersIcon}
      label="Followers"
      value={formatCompact(stats.followers)}
      hint={`Following ${formatNumber(stats.following)}`}
    />
    <StatCard
      icon={PlayIcon}
      tone="violet"
      label="Content"
      value={formatNumber(stats.videos + stats.shorts)}
      hint={`${formatNumber(stats.videos)} videos · ${formatNumber(stats.shorts)} shorts · ${formatNumber(stats.posts)} posts`}
    />
    <StatCard
      icon={EyeIcon}
      tone="blue"
      label="Total views"
      value={formatCompact(stats.totalViews)}
      hint={`${formatCompact(stats.totalLikes)} likes on videos`}
    />
    <StatCard
      icon={FlagIcon}
      tone={stats.reportsOnVideos > 0 ? "red" : "green"}
      label="Reports on content"
      value={formatNumber(stats.reportsOnVideos)}
      hint={`Filed ${formatNumber(stats.reportsFiled)} report${stats.reportsFiled === 1 ? "" : "s"}`}
    />
    <StatCard
      icon={WalletIcon}
      tone="green"
      label="Wallet balance"
      value={formatINR(user.walletBalance)}
      hint={`Pending ${formatINR(user.pendingBalance)}`}
    />
    <StatCard icon={TrendingUpIcon} tone="green" label="Total earnings" value={formatINR(user.totalEarnings)} hint={`${formatNumber(stats.withdrawals)} payout request(s)`} />
    <StatCard icon={CoinsIcon} tone="amber" label="Coins" value={formatNumber(user.coins)} hint={`${formatNumber(stats.boosts)} boost(s) bought`} />
    <StatCard
      icon={HeartIcon}
      tone="red"
      label="Activity"
      value={formatNumber(stats.comments)}
      hint={`comments · ${formatNumber(stats.likedVideos)} liked · ${formatNumber(stats.chats)} chats`}
    />
  </div>
);

export default ProfileStats;
