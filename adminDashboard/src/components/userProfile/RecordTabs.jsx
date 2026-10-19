import UserLink from "../UserLink";
import { StatusBadge, TableCard, Th, Td, Badge } from "./ui";
import { resolveMediaUrl } from "../../lib/adminApi";
import { formatDateTime, formatINR, formatNumber } from "../../lib/format";

const VideoCell = ({ video, onPlay }) => {
  if (!video) return <span className="text-xs text-muted">Deleted video</span>;
  return (
    <button type="button" onClick={() => onPlay(video)} className="group flex min-w-0 items-center gap-3 text-left">
      {video.thumbnail ? (
        <img src={resolveMediaUrl(video.thumbnail)} alt="" loading="lazy" className="h-11 w-[72px] shrink-0 rounded-lg border border-line bg-surface object-cover" />
      ) : (
        <span className="grid h-11 w-[72px] shrink-0 place-items-center rounded-lg bg-surface text-muted">🎬</span>
      )}
      <span className="line-clamp-2 text-sm font-semibold text-ink group-hover:text-brand group-hover:underline">{video.title || "Untitled"}</span>
    </button>
  );
};

export const ReportsTable = ({ items, onPlay, filed }) => (
  <TableCard>
    <thead>
      <tr className="border-b border-line bg-surface/60">
        <Th>Video</Th>
        <Th>{filed ? "Creator" : "Reported by"}</Th>
        <Th>Reason</Th>
        <Th>Status</Th>
        <Th>Date</Th>
      </tr>
    </thead>
    <tbody>
      {items.map((r) => (
        <tr key={r._id} className="border-t border-line hover:bg-surface/40">
          <Td className="max-w-xs"><VideoCell video={r.video} onPlay={onPlay} /></Td>
          <Td className="text-xs">{filed ? <UserLink user={r.video && r.video.owner} withAvatar avatarSize="xs" /> : <UserLink user={r.reporter} withAvatar avatarSize="xs" />}</Td>
          <Td className="max-w-xs text-xs text-ink">“{r.reason}”{r.adminNote && <p className="mt-1 text-muted">Admin: {r.adminNote}</p>}</Td>
          <Td><StatusBadge status={r.status} /></Td>
          <Td className="whitespace-nowrap text-xs text-muted">{formatDateTime(r.createdAt)}</Td>
        </tr>
      ))}
    </tbody>
  </TableCard>
);

const Amount = ({ value, positive }) => (
  <span className={`font-semibold ${positive ? "text-emerald-600" : "text-ink"}`}>{value}</span>
);

const EARNINGS_VIEWS = {
  credits: {
    head: ["Video", "Source", "Amount", "Status", "Available", "Date"],
    row: (c, onPlay) => [
      <VideoCell key="v" video={c.video} onPlay={onPlay} />,
      <Badge key="s">{String(c.source || "").replace(/_/g, " ")}</Badge>,
      <Amount key="a" value={formatINR(c.amount)} positive={c.status === "credited"} />,
      <StatusBadge key="st" status={c.status} />,
      <span key="av" className="text-xs text-muted">{formatDateTime(c.availableAt)}</span>,
      <span key="d" className="text-xs text-muted">{formatDateTime(c.createdAt)}</span>,
    ],
  },
  coins: {
    head: ["Type", "Description", "Coins", "Balance after", "Date"],
    row: (t) => [
      <Badge key="t">{String(t.type || "").replace(/_/g, " ")}</Badge>,
      <span key="d" className="text-xs text-ink">{t.description || "—"}</span>,
      <Amount key="a" value={`${t.amount > 0 ? "+" : ""}${formatNumber(t.amount)}`} positive={t.amount > 0} />,
      <span key="b" className="text-xs">{formatNumber(t.balanceAfter)}</span>,
      <span key="dt" className="text-xs text-muted">{formatDateTime(t.createdAt)}</span>,
    ],
  },
  withdrawals: {
    head: ["Amount", "Method", "Status", "Transaction", "Requested", "Processed"],
    row: (w) => [
      <Amount key="a" value={formatINR(w.amount)} />,
      <span key="m" className="text-xs uppercase">{w.payoutMethod}</span>,
      <StatusBadge key="s" status={w.status} />,
      <span key="t" className="font-mono text-[11px] text-muted">{w.transactionId || "—"}{w.adminNote && <p className="font-sans">{w.adminNote}</p>}</span>,
      <span key="r" className="text-xs text-muted">{formatDateTime(w.createdAt)}</span>,
      <span key="p" className="text-xs text-muted">{formatDateTime(w.processedAt)}</span>,
    ],
  },
  reviews: {
    head: ["Video", "Status", "Ads watched", "Passed via", "Message", "Date"],
    row: (r, onPlay) => [
      <VideoCell key="v" video={r.video} onPlay={onPlay} />,
      <StatusBadge key="s" status={r.status} />,
      <span key="a" className="text-xs">{formatNumber(r.adsWatched)} / {formatNumber(r.adsRequired)}</span>,
      <span key="p" className="text-xs capitalize">{r.passedVia ? String(r.passedVia).replace(/_/g, " ") : "—"}</span>,
      <span key="m" className="text-xs text-muted">{r.reviewMessage || "—"}</span>,
      <span key="d" className="text-xs text-muted">{formatDateTime(r.createdAt)}</span>,
    ],
  },
};

export const EarningsTable = ({ items, view, onPlay }) => {
  const config = EARNINGS_VIEWS[view] || EARNINGS_VIEWS.credits;
  return (
    <TableCard>
      <thead>
        <tr className="border-b border-line bg-surface/60">{config.head.map((h) => <Th key={h}>{h}</Th>)}</tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item._id} className="border-t border-line hover:bg-surface/40">
            {config.row(item, onPlay).map((cell, i) => (
              <Td key={i} className={i === 0 ? "max-w-xs" : ""}>{cell}</Td>
            ))}
          </tr>
        ))}
      </tbody>
    </TableCard>
  );
};

export const BoostsTable = ({ items, onPlay }) => (
  <TableCard>
    <thead>
      <tr className="border-b border-line bg-surface/60">
        <Th>Video</Th>
        <Th>Coins</Th>
        <Th>Duration</Th>
        <Th>Status</Th>
        <Th>Started</Th>
        <Th>Ends</Th>
      </tr>
    </thead>
    <tbody>
      {items.map((b) => (
        <tr key={b._id} className="border-t border-line hover:bg-surface/40">
          <Td className="max-w-xs"><VideoCell video={b.video} onPlay={onPlay} /></Td>
          <Td className="text-sm font-semibold">🪙 {formatNumber(b.coinsSpent)}</Td>
          <Td className="text-xs">{b.durationHours}h</Td>
          <Td>
            <StatusBadge status={b.status} />
            {b.status === "queued" && b.queuePosition ? <p className="mt-1 text-[11px] text-muted">#{b.queuePosition} in queue</p> : null}
          </Td>
          <Td className="whitespace-nowrap text-xs text-muted">{formatDateTime(b.startedAt || b.estimatedStartTime)}</Td>
          <Td className="whitespace-nowrap text-xs text-muted">{formatDateTime(b.expiresAt)}</Td>
        </tr>
      ))}
    </tbody>
  </TableCard>
);

export const PlaylistsList = ({ items }) => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
    {items.map((p) => (
      <div key={p._id} className="rounded-2xl border border-line bg-white p-3.5 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-semibold text-ink">{p.name}</p>
          {p.isPrivate ? <Badge>Private</Badge> : <Badge tone="green">Public</Badge>}
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {(p.videos || []).slice(0, 4).map((v) => (
            <img key={v._id} src={resolveMediaUrl(v.thumbnail)} alt="" loading="lazy" className="aspect-video w-full rounded-md bg-surface object-cover" />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted">Created {formatDateTime(p.createdAt)}</p>
      </div>
    ))}
  </div>
);
