const mongoose = require('mongoose');
const Video = require('../models/Video');
const User = require('../models/User');

const BASE_URL = process.env.PUBLIC_WEB_URL || 'https://bideo.in';
const PLAY_STORE_URL =
  process.env.PLAY_STORE_URL ||
  'https://play.google.com/store/apps/details?id=com.farhan.bideoapp';
const APP_PACKAGE = 'com.farhan.bideoapp';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeJson(str) {
  if (!str) return '';
  return JSON.stringify(String(str)).slice(1, -1);
}

function formatIsoDuration(seconds) {
  if (!seconds || isNaN(seconds)) return 'PT1M';
  const total = Math.max(1, Math.round(Number(seconds)));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `PT${m}M${s}S`;
}

function resolveMediaUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const clean = url.startsWith('/') ? url : `/${url}`;
  return `${BASE_URL}${clean}`;
}

// In-memory cache for sitemap (1 hour)
let sitemapCache = {
  xml: '',
  expiresAt: 0,
};

// @desc    Public web landing page for a video (SEO, OpenGraph & Deep Linking)
// @route   GET /v/:id and /api/v/:id
// @access  Public
exports.getVideoPage = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Video Unavailable - Bideo</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0F0F0F; color: #FFF; text-align: center; padding: 60px 20px; }
            h1 { font-size: 24px; margin-bottom: 12px; }
            p { color: #888; font-size: 14px; margin-bottom: 24px; }
            a { display: inline-block; background: #FF7A00; color: #FFF; text-decoration: none; padding: 12px 28px; border-radius: 25px; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Video Unavailable</h1>
          <p>This video may have been removed or is not publicly accessible.</p>
          <a href="${PLAY_STORE_URL}">Watch on Bideo App</a>
        </body>
        </html>
      `);
    }

    const video = await Video.findById(id).populate(
      'owner',
      'name channelName avatar isVerified followersCount about'
    );

    if (!video || video.visibility === 'private' || video.isBlocked) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Video Unavailable - Bideo</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0F0F0F; color: #FFF; text-align: center; padding: 60px 20px; }
            h1 { font-size: 24px; margin-bottom: 12px; }
            p { color: #888; font-size: 14px; margin-bottom: 24px; }
            a { display: inline-block; background: #FF7A00; color: #FFF; text-decoration: none; padding: 12px 28px; border-radius: 25px; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Video Unavailable</h1>
          <p>This video may have been removed or made private by the creator.</p>
          <a href="${PLAY_STORE_URL}">Explore Bideo App</a>
        </body>
        </html>
      `);
    }

    const title = video.title || 'Watch on Bideo';
    const description =
      video.description ||
      `Watch ${title} by ${video.owner?.channelName || 'Bideo Creator'} on Bideo. Watch trending shorts, reels and viral videos.`;
    const thumbnailUrl = resolveMediaUrl(video.thumbnail);
    const videoUrl = resolveMediaUrl(video.videoUrl);
    const canonicalUrl = `${BASE_URL}/v/${video._id}`;
    const channelName = video.owner?.channelName || video.owner?.name || 'Bideo Creator';
    const channelAvatar = resolveMediaUrl(video.owner?.avatar) || 'https://via.placeholder.com/100';
    const deepLink = `bideo://video/${video._id}`;
    const intentLink = `intent://video/${video._id}#Intent;scheme=bideo;package=${APP_PACKAGE};S.browser_fallback_url=${encodeURIComponent(canonicalUrl)};end`;
    const viewsFormatted = Number(video.views || 0).toLocaleString('en-IN');
    const uploadDate = new Date(video.createdAt || Date.now()).toISOString();

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>${escapeHtml(title)} - Bideo</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonicalUrl}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-video-preview:-1">

  <!-- OpenGraph / Facebook / WhatsApp -->
  <meta property="og:site_name" content="Bideo">
  <meta property="og:type" content="video.other">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:image" content="${thumbnailUrl}">
  <meta property="og:image:secure_url" content="${thumbnailUrl}">
  <meta property="og:image:width" content="1280">
  <meta property="og:image:height" content="720">
  <meta property="og:image:alt" content="${escapeHtml(title)}">
  <meta property="og:video" content="${videoUrl}">
  <meta property="og:video:secure_url" content="${videoUrl}">
  <meta property="og:video:type" content="video/mp4">
  <meta property="og:video:width" content="1280">
  <meta property="og:video:height" content="720">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@BideoApp">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${thumbnailUrl}">
  <meta name="twitter:app:name:googleplay" content="Bideo">
  <meta name="twitter:app:id:googleplay" content="${APP_PACKAGE}">
  <meta name="twitter:app:url:googleplay" content="${deepLink}">

  <!-- Android Deep Link Metadata -->
  <meta property="al:android:url" content="${deepLink}">
  <meta property="al:android:app_name" content="Bideo">
  <meta property="al:android:package" content="${APP_PACKAGE}">
  <meta property="al:web:url" content="${canonicalUrl}">

  <!-- Schema.org VideoObject Structured Data for Google Search -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": "${escapeJson(title)}",
    "description": "${escapeJson(description)}",
    "thumbnailUrl": ["${thumbnailUrl}"],
    "uploadDate": "${uploadDate}",
    "duration": "${formatIsoDuration(video.duration)}",
    "contentUrl": "${videoUrl}",
    "embedUrl": "${canonicalUrl}",
    "interactionStatistic": {
      "@type": "InteractionCounter",
      "interactionType": { "@type": "https://schema.org/WatchAction" },
      "userInteractionCount": ${video.views || 0}
    },
    "author": {
      "@type": "Person",
      "name": "${escapeJson(channelName)}",
      "url": "${BASE_URL}/c/${video.owner?._id || ''}"
    }
  }
  </script>

  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0F0F0F;
      color: #FFFFFF;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.5;
      padding-bottom: 80px;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 18px;
      background: #181818;
      border-bottom: 1px solid #282828;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
      color: #FFF;
    }
    .brand-logo {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: #FF7A00;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      color: #FFF;
      font-size: 18px;
    }
    .brand-name {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .brand-name span { color: #FF7A00; }
    .header-cta {
      background: #FF7A00;
      color: #FFF;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
      transition: opacity 0.2s;
    }
    .header-cta:hover { opacity: 0.9; }
    .main-container {
      max-width: 820px;
      margin: 0 auto;
      padding: 16px;
    }
    .player-wrapper {
      position: relative;
      width: 100%;
      background: #000;
      border-radius: 14px;
      overflow: hidden;
      aspect-ratio: 16 / 9;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    .player-wrapper video {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .video-info {
      padding: 16px 0;
    }
    .video-title {
      font-size: 18px;
      font-weight: 700;
      color: #F1F1F1;
      margin-bottom: 8px;
    }
    .video-stats {
      font-size: 13px;
      color: #AAAAAA;
      margin-bottom: 16px;
    }
    .creator-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      background: #1E1E1E;
      border-radius: 12px;
      margin-bottom: 20px;
    }
    .creator-left {
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      color: inherit;
    }
    .creator-avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      object-fit: cover;
      background: #333;
    }
    .creator-name {
      font-size: 15px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .verified-icon {
      color: #FF7A00;
      font-size: 14px;
    }
    .creator-followers {
      font-size: 12px;
      color: #AAA;
    }
    .download-banner {
      background: linear-gradient(135deg, #2A1707 0%, #171717 100%);
      border: 1.5px solid #FF7A00;
      border-radius: 16px;
      padding: 20px;
      text-align: center;
      margin-top: 16px;
    }
    .download-banner h3 {
      font-size: 18px;
      color: #FFF;
      margin-bottom: 6px;
    }
    .download-banner p {
      font-size: 13px;
      color: #CCC;
      margin-bottom: 18px;
    }
    .button-group {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      justify-content: center;
    }
    .primary-btn {
      background: #FF7A00;
      color: #FFF;
      padding: 12px 24px;
      border-radius: 25px;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      box-shadow: 0 4px 15px rgba(255, 122, 0, 0.4);
    }
    .secondary-btn {
      background: #262626;
      border: 1px solid #404040;
      color: #FFF;
      padding: 12px 24px;
      border-radius: 25px;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <header>
    <a href="${BASE_URL}" class="brand">
      <div class="brand-logo">B</div>
      <div class="brand-name">Bideo<span>.in</span></div>
    </a>
    <a href="${intentLink}" class="header-cta">Open in App</a>
  </header>

  <div class="main-container">
    <div class="player-wrapper">
      <video controls poster="${thumbnailUrl}" preload="metadata" playsinline>
        <source src="${videoUrl}" type="video/mp4">
        Your browser does not support HTML5 video.
      </video>
    </div>

    <div class="video-info">
      <h1 class="video-title">${escapeHtml(title)}</h1>
      <div class="video-stats">${viewsFormatted} views • Shared via Bideo</div>

      <div class="creator-card">
        <a href="${BASE_URL}/c/${video.owner?._id || ''}" class="creator-left">
          <img src="${channelAvatar}" alt="${escapeHtml(channelName)}" class="creator-avatar" />
          <div>
            <div class="creator-name">
              ${escapeHtml(channelName)}
              ${video.owner?.isVerified ? '<span class="verified-icon">✓</span>' : ''}
            </div>
            <div class="creator-followers">${Number(video.owner?.followersCount || 0).toLocaleString('en-IN')} followers</div>
          </div>
        </a>
        <a href="${intentLink}" class="header-cta" style="padding: 6px 14px; font-size: 12px;">Follow</a>
      </div>

      <div class="download-banner">
        <h3>Watch in Full HD on Bideo</h3>
        <p>Experience ultra-fast playback, trending shorts, reels & earn rewards on India's premier video platform.</p>
        <div class="button-group">
          <a href="${intentLink}" class="primary-btn">⚡ Open in Bideo App</a>
          <a href="${PLAY_STORE_URL}" class="secondary-btn" target="_blank" rel="noopener">Get on Google Play</a>
        </div>
      </div>
    </div>
  </div>

  <script>
    // Auto-attempt opening deep link on mobile devices
    if (/android/i.test(navigator.userAgent)) {
      var appOpened = false;
      var t = setTimeout(function() {
        if (!appOpened && document.hidden !== true) {
          // Stay on web page
        }
      }, 2500);
      window.addEventListener('blur', function() { appOpened = true; clearTimeout(t); });
    }
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (err) {
    next(err);
  }
};

// @desc    Public web landing page for a creator/channel
// @route   GET /c/:id and /api/c/:id
// @access  Public
exports.getChannelPage = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="en"><head><title>Channel Not Found - Bideo</title></head>
        <body style="background:#0F0F0F;color:#FFF;font-family:sans-serif;text-align:center;padding:60px 20px;">
          <h2>Channel Unavailable</h2>
          <p style="color:#888;">This channel may have been removed or suspended.</p>
          <a href="${PLAY_STORE_URL}" style="display:inline-block;margin-top:20px;background:#FF7A00;color:#FFF;padding:10px 20px;border-radius:20px;text-decoration:none;">Explore Bideo</a>
        </body></html>
      `);
    }

    const channel = await User.findById(id).select(
      'name channelName avatar about followersCount isVerified isBlocked'
    );

    if (!channel || channel.isBlocked) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="en"><head><title>Channel Not Found - Bideo</title></head>
        <body style="background:#0F0F0F;color:#FFF;font-family:sans-serif;text-align:center;padding:60px 20px;">
          <h2>Channel Unavailable</h2>
          <p style="color:#888;">This channel may have been removed or suspended.</p>
          <a href="${PLAY_STORE_URL}" style="display:inline-block;margin-top:20px;background:#FF7A00;color:#FFF;padding:10px 20px;border-radius:20px;text-decoration:none;">Explore Bideo</a>
        </body></html>
      `);
    }

    const channelName = channel.channelName || channel.name || 'Bideo Creator';
    const description =
      channel.about || `Watch videos and shorts by ${channelName} on Bideo.`;
    const avatar = resolveMediaUrl(channel.avatar) || 'https://via.placeholder.com/120';
    const canonicalUrl = `${BASE_URL}/c/${channel._id}`;
    const deepLink = `bideo://channel/${channel._id}`;
    const intentLink = `intent://channel/${channel._id}#Intent;scheme=bideo;package=${APP_PACKAGE};S.browser_fallback_url=${encodeURIComponent(canonicalUrl)};end`;

    // Fetch latest 6 public videos
    const latestVideos = await Video.find({ owner: channel._id, visibility: 'public' })
      .sort({ createdAt: -1 })
      .limit(6)
      .select('title thumbnail views duration createdAt')
      .lean();

    const videoCardsHtml = latestVideos
      .map(
        (v) => `
      <a href="${BASE_URL}/v/${v._id}" style="display:block;text-decoration:none;color:#FFF;background:#1E1E1E;border-radius:10px;overflow:hidden;">
        <div style="aspect-ratio:16/9;background:#000;overflow:hidden;position:relative;">
          <img src="${resolveMediaUrl(v.thumbnail)}" alt="${escapeHtml(v.title)}" style="width:100%;height:100%;object-fit:cover;" />
        </div>
        <div style="padding:10px;">
          <div style="font-size:14px;font-weight:700;line-height:1.3;max-height:2.6em;overflow:hidden;">${escapeHtml(v.title)}</div>
          <div style="font-size:12px;color:#888;margin-top:4px;">${Number(v.views || 0).toLocaleString('en-IN')} views</div>
        </div>
      </a>
    `
      )
      .join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(channelName)} - Bideo Creator</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonicalUrl}">
  <meta name="robots" content="index, follow">

  <!-- OpenGraph -->
  <meta property="og:site_name" content="Bideo">
  <meta property="og:type" content="profile">
  <meta property="og:title" content="${escapeHtml(channelName)} on Bideo">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:image" content="${avatar}">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(channelName)} on Bideo">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${avatar}">

  <!-- Schema.org ProfilePage -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "mainEntity": {
      "@type": "Person",
      "name": "${escapeJson(channelName)}",
      "description": "${escapeJson(description)}",
      "image": "${avatar}",
      "interactionStatistic": {
        "@type": "InteractionCounter",
        "interactionType": { "@type": "https://schema.org/FollowAction" },
        "userInteractionCount": ${channel.followersCount || 0}
      }
    }
  }
  </script>

  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0F0F0F; color: #FFF; font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding-bottom: 60px; }
    header { display: flex; align-items: center; justify-content: space-between; padding: 12px 18px; background: #181818; border-bottom: 1px solid #282828; }
    .channel-header { text-align: center; padding: 30px 16px 20px; max-width: 600px; margin: 0 auto; }
    .channel-avatar { width: 88px; height: 88px; border-radius: 50%; object-fit: cover; border: 3px solid #FF7A00; margin-bottom: 12px; }
    .channel-title { font-size: 22px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 6px; }
    .channel-handle { color: #888; font-size: 14px; margin-bottom: 8px; }
    .channel-about { font-size: 13px; color: #CCC; margin-bottom: 16px; line-height: 1.5; }
    .cta-btn { display: inline-block; background: #FF7A00; color: #FFF; padding: 10px 28px; border-radius: 20px; font-weight: 700; text-decoration: none; font-size: 14px; }
    .video-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; max-width: 820px; margin: 24px auto 0; padding: 0 16px; }
  </style>
</head>
<body>
  <header>
    <a href="${BASE_URL}" style="text-decoration:none;color:#FFF;font-weight:800;font-size:18px;">Bideo<span style="color:#FF7A00;">.in</span></a>
    <a href="${intentLink}" style="background:#FF7A00;color:#FFF;padding:6px 14px;border-radius:16px;font-size:12px;font-weight:bold;text-decoration:none;">Open in App</a>
  </header>

  <div class="channel-header">
    <img src="${avatar}" alt="${escapeHtml(channelName)}" class="channel-avatar" />
    <h1 class="channel-title">${escapeHtml(channelName)} ${channel.isVerified ? '<span style="color:#FF7A00;">✓</span>' : ''}</h1>
    <div class="channel-handle">@${escapeHtml(channel.name || 'user')} • ${Number(channel.followersCount || 0).toLocaleString('en-IN')} followers</div>
    ${description ? `<p class="channel-about">${escapeHtml(description)}</p>` : ''}
    <a href="${intentLink}" class="cta-btn">Follow on Bideo App</a>
  </div>

  ${videoCardsHtml ? `<div class="video-grid">${videoCardsHtml}</div>` : ''}
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (err) {
    next(err);
  }
};

// @desc    Dynamic Google Video Sitemap (XML)
// @route   GET /sitemap.xml and /api/sitemap.xml
// @access  Public
exports.getSitemap = async (req, res, next) => {
  try {
    const now = Date.now();
    if (sitemapCache.xml && sitemapCache.expiresAt > now) {
      res.setHeader('Content-Type', 'application/xml');
      return res.status(200).send(sitemapCache.xml);
    }

    const videos = await Video.find({ visibility: 'public', isBlocked: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(1000)
      .select('title description thumbnail videoUrl views createdAt duration')
      .lean();

    const channels = await User.find({ isBlocked: { $ne: true } })
      .sort({ followersCount: -1 })
      .limit(200)
      .select('_id updatedAt')
      .lean();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
  <url>
    <loc>${BASE_URL}</loc>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>`;

    for (const v of videos) {
      const loc = `${BASE_URL}/v/${v._id}`;
      const thumb = resolveMediaUrl(v.thumbnail);
      const contentLoc = resolveMediaUrl(v.videoUrl);
      const pubDate = new Date(v.createdAt || Date.now()).toISOString();
      const title = escapeHtml(v.title || 'Bideo Video');
      const desc = escapeHtml(v.description || v.title || 'Watch on Bideo');

      xml += `
  <url>
    <loc>${loc}</loc>
    <video:video>
      <video:thumbnail_loc>${thumb}</video:thumbnail_loc>
      <video:title>${title}</video:title>
      <video:description>${desc}</video:description>
      <video:content_loc>${contentLoc}</video:content_loc>
      <video:publication_date>${pubDate}</video:publication_date>
      <video:view_count>${v.views || 0}</video:view_count>
      <video:family_friendly>yes</video:family_friendly>
    </video:video>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    }

    for (const ch of channels) {
      xml += `
  <url>
    <loc>${BASE_URL}/c/${ch._id}</loc>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`;
    }

    xml += `
</urlset>`;

    sitemapCache = {
      xml,
      expiresAt: now + 60 * 60 * 1000, // cache for 1 hour
    };

    res.setHeader('Content-Type', 'application/xml');
    res.status(200).send(xml);
  } catch (err) {
    next(err);
  }
};

// @desc    Standard robots.txt
// @route   GET /robots.txt and /api/robots.txt
// @access  Public
exports.getRobots = (req, res) => {
  const robotsTxt = `User-agent: *
Allow: /
Allow: /v/
Allow: /c/
Disallow: /api/
Disallow: /admin/
Sitemap: ${BASE_URL}/sitemap.xml
`;
  res.setHeader('Content-Type', 'text/plain');
  res.status(200).send(robotsTxt);
};

// @desc    Android Digital Asset Links for verified App Links
// @route   GET /.well-known/assetlinks.json and /api/.well-known/assetlinks.json
// @access  Public
exports.getAssetLinks = (req, res) => {
  const fingerprints = (
    process.env.ANDROID_SHA256_FINGERPRINTS ||
    '14:6D:E9:7D:0F:52:AB:F9:EE:4B:E4:36:9C:2C:19:D4:58:62:3B:5A:F3:11:79:2E:39:69:BD:24:D1:D7:9F:DF'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const assetLinks = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: APP_PACKAGE,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];

  res.setHeader('Content-Type', 'application/json');
  res.status(200).json(assetLinks);
};
