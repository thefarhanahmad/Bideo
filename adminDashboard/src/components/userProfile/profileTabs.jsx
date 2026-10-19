import { VideoGrid, PostsList, StoriesGrid } from "./ContentTabs";
import { PeopleList, CommentsList, ChatsList } from "./SocialTabs";
import { ReportsTable, EarningsTable, BoostsTable, PlaylistsList } from "./RecordTabs";

// Declarative config for each profile tab: API tab, controls, counts and renderer.

const VISIBILITY = [
  { label: "All", value: "all" },
  { label: "Public", value: "public" },
  { label: "Unlisted", value: "unlisted" },
  { label: "Private", value: "private" },
];
const VIDEO_SORTS = [
  { label: "Latest", value: "" },
  { label: "Most viewed", value: "popular" },
  { label: "Oldest", value: "oldest" },
];

export const PROFILE_TABS = [
  {
    key: "videos",
    label: "Videos",
    count: (s) => s.videos,
    search: "Search videos by title…",
    filters: VISIBILITY,
    sorts: VIDEO_SORTS,
    empty: ["🎬", "No videos uploaded"],
    render: ({ items, onPlay }) => <VideoGrid items={items} onPlay={onPlay} />,
  },
  {
    key: "shorts",
    label: "Shorts",
    count: (s) => s.shorts,
    search: "Search shorts by title…",
    filters: VISIBILITY,
    sorts: VIDEO_SORTS,
    empty: ["📱", "No shorts uploaded"],
    render: ({ items, onPlay }) => <VideoGrid items={items} onPlay={onPlay} />,
  },
  {
    key: "posts",
    label: "Posts",
    count: (s) => s.posts,
    search: "Search posts…",
    filters: VISIBILITY,
    sorts: [
      { label: "Latest", value: "" },
      { label: "Most comments", value: "popular" },
      { label: "Oldest", value: "oldest" },
    ],
    empty: ["📝", "No community posts"],
    render: ({ items }) => <PostsList items={items} />,
  },
  {
    key: "stories",
    label: "Stories",
    count: (s) => s.stories,
    views: [
      { label: "All", value: "" },
      { label: "Live", value: "active" },
      { label: "Expired", value: "expired" },
    ],
    empty: ["⭕", "No stories"],
    render: ({ items }) => <StoriesGrid items={items} />,
  },
  {
    key: "followers",
    label: "Followers",
    count: (s) => s.followers,
    views: (s) => [
      { label: "Followers", value: "", count: s.followers },
      { label: "Following", value: "following", count: s.following },
    ],
    apiTab: (p) => (p.filter === "following" ? "following" : "followers"),
    empty: ["👥", "Nobody here yet"],
    render: ({ items, params }) => <PeopleList items={items} field={params.filter === "following" ? "channel" : "follower"} />,
  },
  {
    key: "comments",
    label: "Comments",
    count: (s) => s.comments,
    search: "Search comments…",
    empty: ["💬", "No comments written"],
    render: ({ items, onPlay }) => <CommentsList items={items} onPlay={onPlay} />,
  },
  {
    key: "reports",
    label: "Reports",
    count: (s) => s.reportsOnVideos + s.reportsFiled,
    views: (s) => [
      { label: "On their content", value: "", count: s.reportsOnVideos },
      { label: "Filed by them", value: "filed", count: s.reportsFiled },
    ],
    statuses: [
      { label: "Any status", value: "" },
      { label: "Open", value: "open" },
      { label: "Reviewed", value: "reviewed" },
      { label: "Actioned", value: "actioned" },
      { label: "Dismissed", value: "dismissed" },
    ],
    empty: ["🚩", "No reports"],
    render: ({ items, onPlay, params }) => <ReportsTable items={items} onPlay={onPlay} filed={params.filter === "filed"} />,
  },
  {
    key: "earnings",
    label: "Earnings",
    views: (s) => [
      { label: "Wallet credits", value: "" },
      { label: "Coins", value: "coins" },
      { label: "Payouts", value: "withdrawals", count: s.withdrawals },
      { label: "Monetization reviews", value: "reviews" },
    ],
    statuses: (p) =>
      p.filter
        ? null
        : [
            { label: "Any status", value: "" },
            { label: "Pending", value: "pending" },
            { label: "Credited", value: "credited" },
            { label: "Cancelled", value: "cancelled" },
          ],
    empty: ["💰", "No records"],
    render: ({ items, onPlay, params }) => <EarningsTable items={items} view={params.filter || "credits"} onPlay={onPlay} />,
  },
  {
    key: "boosts",
    label: "Boosts",
    count: (s) => s.boosts,
    views: [
      { label: "All", value: "" },
      { label: "Queued", value: "queued" },
      { label: "Active", value: "active" },
      { label: "Completed", value: "completed" },
      { label: "Cancelled", value: "cancelled" },
    ],
    empty: ["🚀", "No boosts purchased"],
    render: ({ items, onPlay }) => <BoostsTable items={items} onPlay={onPlay} />,
  },
  {
    key: "activity",
    label: "Activity",
    views: (s) => [
      { label: "Watch history", value: "", count: s.watchHistory },
      { label: "Liked videos", value: "liked", count: s.likedVideos },
      { label: "Playlists", value: "playlists", count: s.playlists },
    ],
    empty: ["🕘", "No activity yet"],
    render: ({ items, onPlay, params }) =>
      params.filter === "playlists" ? <PlaylistsList items={items} /> : <VideoGrid items={items} onPlay={onPlay} showOwner />,
  },
  {
    key: "chats",
    label: "Chats",
    count: (s) => s.chats,
    empty: ["✉️", "No conversations"],
    render: ({ items, userId }) => <ChatsList items={items} profileUserId={userId} />,
  },
];

export const findTab = (key) => PROFILE_TABS.find((t) => t.key === key) || PROFILE_TABS[0];
