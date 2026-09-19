import Videos from "./Videos";

/**
 * ServerVideos Component
 *
 * Dedicated admin page displaying only videos, shorts, and community posts
 * hosted directly on the VPS server disk (/uploads/) rather than Cloudflare R2
 * or Cloudinary. Enables admins to inspect, preview, and permanently delete
 * legacy server-stored media to reclaim server disk space.
 */
const ServerVideos = () => {
  return <Videos isServerOnly={true} />;
};

export default ServerVideos;
