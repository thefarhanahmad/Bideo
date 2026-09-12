const mongoose = require('mongoose');
const Video = require('../models/Video');
const User = require('../models/User');
const Post = require('../models/Post');

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

function isCrawler(ua) {
  if (!ua || typeof ua !== 'string') return false;
  return /bot|crawler|spider|facebookexternalhit|whatsapp|telegrambot|twitterbot|slackbot|discordbot|linkedinbot|pinterest|applebot|bingbot|googlebot/i.test(
    ua
  );
}

function renderNotFoundHtml(title, message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Bideo</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0F0F0F; color: #FFF; text-align: center; padding: 60px 20px; }
    h1 { font-size: 24px; margin-bottom: 12px; }
    p { color: #888; font-size: 14px; margin-bottom: 24px; }
    a { display: inline-block; background: #FF7A00; color: #FFF; text-decoration: none; padding: 12px 28px; border-radius: 25px; font-weight: bold; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(message)}</p>
  <a href="${PLAY_STORE_URL}">Explore Bideo App</a>
</body>
</html>`;
}

function renderLauncherHtml({
  title,
  description,
  imageUrl,
  canonicalUrl,
  deepLink,
  intentLink,
  ogType = 'website',
  videoUrl = null,
  creatorName = '',
  creatorAvatar = '',
  isCrawlerReq = false,
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>${escapeHtml(title)} - Bideo</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonicalUrl}">
  <meta name="robots" content="index, follow, max-image-preview:large">

  <!-- OpenGraph / Facebook / WhatsApp -->
  <meta property="og:site_name" content="Bideo">
  <meta property="og:type" content="${ogType}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonicalUrl}">
  ${imageUrl ? `
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:secure_url" content="${imageUrl}">
  <meta property="og:image:width" content="1280">
  <meta property="og:image:height" content="720">
  <meta property="og:image:alt" content="${escapeHtml(title)}">
  ` : ''}
  ${videoUrl ? `
  <meta property="og:video" content="${videoUrl}">
  <meta property="og:video:secure_url" content="${videoUrl}">
  <meta property="og:video:type" content="video/mp4">
  <meta property="og:video:width" content="1280">
  <meta property="og:video:height" content="720">
  ` : ''}

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@BideoApp">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  ${imageUrl ? `<meta name="twitter:image" content="${imageUrl}">` : ''}
  <meta name="twitter:app:name:googleplay" content="Bideo">
  <meta name="twitter:app:id:googleplay" content="${APP_PACKAGE}">
  <meta name="twitter:app:url:googleplay" content="${deepLink}">

  <!-- Android Deep Link Metadata -->
  <meta property="al:android:url" content="${deepLink}">
  <meta property="al:android:app_name" content="Bideo">
  <meta property="al:android:package" content="${APP_PACKAGE}">
  <meta property="al:web:url" content="${canonicalUrl}">

  ${!isCrawlerReq ? `
  <script>
    (function() {
      var ua = navigator.userAgent || '';
      var isAndroid = /android/i.test(ua);
      var isIOS = /iphone|ipad|ipod/i.test(ua);
      var intentUrl = "${intentLink}";
      var playStoreUrl = "${PLAY_STORE_URL}";

      if (isAndroid) {
        // Attempt immediate app launch via Android Intent
        window.location.href = intentUrl;
        var start = Date.now();
        setTimeout(function() {
          // If browser is still foreground (app not installed), forward to Play Store
          if (Date.now() - start < 1800) {
            window.location.href = playStoreUrl;
          }
        }, 1000);
      } else if (isIOS) {
        window.location.href = playStoreUrl;
      }
    })();
  </script>
  ` : ''}

  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0F0F0F;
      color: #FFFFFF;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      text-align: center;
    }
    .launcher-card {
      background: #181818;
      border: 1px solid #282828;
      border-radius: 24px;
      padding: 28px 22px;
      max-width: 440px;
      width: 100%;
      box-shadow: 0 12px 36px rgba(0,0,0,0.6);
    }
    .app-badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 20px;
    }
    .logo-box {
      width: 40px;
      height: 40px;
      background: #FF7A00;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      color: #FFF;
      font-size: 22px;
    }
    .app-name {
      font-size: 22px;
      font-weight: 800;
      color: #FFF;
      letter-spacing: -0.5px;
    }
    .app-name span { color: #FF7A00; }
    .media-preview {
      width: 100%;
      aspect-ratio: 16/9;
      border-radius: 14px;
      object-fit: cover;
      background: #000;
      margin-bottom: 16px;
      border: 1px solid #333;
    }
    .avatar-preview {
      width: 84px;
      height: 84px;
      border-radius: 42px;
      object-fit: cover;
      margin: 0 auto 16px;
      border: 3px solid #FF7A00;
      display: block;
    }
    .title {
      font-size: 18px;
      font-weight: 700;
      line-height: 1.4;
      margin-bottom: 8px;
      color: #FFF;
    }
    .desc {
      font-size: 13.5px;
      color: #9CA3AF;
      line-height: 1.5;
      margin-bottom: 22px;
      max-height: 3.8em;
      overflow: hidden;
    }
    .status-text {
      font-size: 13px;
      color: #FF7A00;
      font-weight: 600;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .btn-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;
    }
    .primary-btn {
      background: #FF7A00;
      color: #FFF;
      text-decoration: none;
      padding: 15px 20px;
      border-radius: 28px;
      font-weight: 700;
      font-size: 15px;
      display: block;
      box-shadow: 0 4px 14px rgba(255, 122, 0, 0.4);
    }
    .primary-btn:active { opacity: 0.9; }
    .secondary-btn {
      background: #262626;
      color: #E5E7EB;
      border: 1px solid #383838;
      text-decoration: none;
      padding: 14px 20px;
      border-radius: 28px;
      font-weight: 600;
      font-size: 14px;
      display: block;
    }
  </style>
</head>
<body>
  <div class="launcher-card">
    <div class="app-badge">
      <div class="logo-box">B</div>
      <div class="app-name">Bideo<span>.in</span></div>
    </div>

    ${imageUrl ? (
      ogType === 'profile'
        ? `<img src="${imageUrl}" alt="${escapeHtml(title)}" class="avatar-preview" />`
        : `<img src="${imageUrl}" alt="${escapeHtml(title)}" class="media-preview" />`
    ) : ''}

    <h1 class="title">${escapeHtml(title)}</h1>
    ${description ? `<p class="desc">${escapeHtml(description)}</p>` : ''}

    <div class="status-text">⚡ Opening in Bideo App...</div>

    <div class="btn-group">
      <a href="${intentLink}" class="primary-btn">Open in Bideo App</a>
      <a href="${PLAY_STORE_URL}" class="secondary-btn" target="_blank" rel="noopener">Get on Google Play</a>
    </div>
  </div>
</body>
</html>`;
}

// In-memory cache for sitemap (1 hour)
let sitemapCache = {
  xml: '',
  expiresAt: 0,
};

// @desc    Public web landing page for a video (SEO, OpenGraph & Deep Linking)
// @route   GET /v/:id and /api/v/:id and /video/:id and /watch/:id
// @access  Public
exports.getVideoPage = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).send(renderNotFoundHtml('Video Unavailable', 'This video may have been removed or is not publicly accessible.'));
    }

    const video = await Video.findById(id).populate(
      'owner',
      'name channelName avatar isVerified followersCount about'
    );

    if (!video || video.visibility === 'private' || video.isBlocked) {
      return res.status(404).send(renderNotFoundHtml('Video Unavailable', 'This video may have been removed or made private by the creator.'));
    }

    const title = video.title || 'Watch on Bideo';
    const description =
      video.description ||
      `Watch ${title} by ${video.owner?.channelName || 'Bideo Creator'} on Bideo.`;
    const thumbnailUrl = resolveMediaUrl(video.thumbnail);
    const videoUrl = resolveMediaUrl(video.videoUrl);
    const canonicalUrl = `${BASE_URL}/v/${video._id}`;
    const channelName = video.owner?.channelName || video.owner?.name || 'Bideo Creator';
    const channelAvatar = resolveMediaUrl(video.owner?.avatar) || 'https://via.placeholder.com/100';
    const deepLink = `bideo://video/${video._id}`;
    const intentLink = `intent://video/${video._id}#Intent;scheme=bideo;package=${APP_PACKAGE};S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};end`;
    const isCrawlerReq = isCrawler(req.headers['user-agent']);

    const html = renderLauncherHtml({
      title,
      description,
      imageUrl: thumbnailUrl,
      canonicalUrl,
      deepLink,
      intentLink,
      ogType: 'video.other',
      videoUrl,
      creatorName: channelName,
      creatorAvatar: channelAvatar,
      isCrawlerReq,
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (err) {
    next(err);
  }
};

// @desc    Public web landing page for a creator/channel
// @route   GET /c/:id and /api/c/:id and /channel/:id
// @access  Public
exports.getChannelPage = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).send(renderNotFoundHtml('Channel Unavailable', 'This channel may have been removed or suspended.'));
    }

    const channel = await User.findById(id).select(
      'name channelName avatar about followersCount isVerified isBlocked'
    );

    if (!channel || channel.isBlocked) {
      return res.status(404).send(renderNotFoundHtml('Channel Unavailable', 'This channel may have been removed or suspended.'));
    }

    const channelName = channel.channelName || channel.name || 'Bideo Creator';
    const description =
      channel.about || `Watch videos and shorts by ${channelName} on Bideo.`;
    const avatar = resolveMediaUrl(channel.avatar) || 'https://via.placeholder.com/120';
    const canonicalUrl = `${BASE_URL}/c/${channel._id}`;
    const deepLink = `bideo://channel/${channel._id}`;
    const intentLink = `intent://channel/${channel._id}#Intent;scheme=bideo;package=${APP_PACKAGE};S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};end`;
    const isCrawlerReq = isCrawler(req.headers['user-agent']);

    const html = renderLauncherHtml({
      title: `${channelName} on Bideo`,
      description,
      imageUrl: avatar,
      canonicalUrl,
      deepLink,
      intentLink,
      ogType: 'profile',
      creatorName: channelName,
      creatorAvatar: avatar,
      isCrawlerReq,
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (err) {
    next(err);
  }
};

// @desc    Public web landing page for a community post (SEO, OpenGraph & Deep Linking)
// @route   GET /p/:id and /api/p/:id and /post/:id
// @access  Public
exports.getPostPage = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).send(renderNotFoundHtml('Post Unavailable', 'This post may have been removed or is not publicly accessible.'));
    }

    const post = await Post.findById(id).populate(
      'owner',
      'name channelName avatar isVerified followersCount'
    );

    if (!post || post.visibility === 'private') {
      return res.status(404).send(renderNotFoundHtml('Post Unavailable', 'This post may have been removed or made private by the creator.'));
    }

    const channelName = post.owner?.channelName || post.owner?.name || 'Bideo Creator';
    const channelAvatar = resolveMediaUrl(post.owner?.avatar) || 'https://via.placeholder.com/100';
    const postSnippet = post.text ? post.text.trim().slice(0, 160) : 'Check out this post on Bideo';
    const title = `Post by ${channelName} on Bideo`;
    const description = post.text ? post.text.trim() : `View updates and photos from ${channelName} on Bideo.`;
    const canonicalUrl = `${BASE_URL}/p/${post._id}`;
    const postImageUrl = post.imageUrl ? resolveMediaUrl(post.imageUrl) : channelAvatar;
    const deepLink = `bideo://post/${post._id}`;
    const intentLink = `intent://post/${post._id}#Intent;scheme=bideo;package=${APP_PACKAGE};S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};end`;
    const isCrawlerReq = isCrawler(req.headers['user-agent']);

    const html = renderLauncherHtml({
      title,
      description,
      imageUrl: postImageUrl,
      canonicalUrl,
      deepLink,
      intentLink,
      ogType: 'article',
      creatorName: channelName,
      creatorAvatar: channelAvatar,
      isCrawlerReq,
    });

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

    const posts = await Post.find({ visibility: 'public' })
      .sort({ createdAt: -1 })
      .limit(200)
      .select('_id createdAt')
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

    for (const p of posts) {
      xml += `
  <url>
    <loc>${BASE_URL}/p/${p._id}</loc>
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
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
Allow: /p/
Allow: /post/
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
    '14:6D:E9:7D:0F:52:AB:F9:EE:4B:E4:36:9C:2C:19:D4:58:62:3B:5A:F3:11:79:2E:39:69:BD:24:D1:D7:9F:DF,FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C'
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
