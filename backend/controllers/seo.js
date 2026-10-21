const mongoose = require('mongoose');
const Video = require('../models/Video');
const User = require('../models/User');
const Post = require('../models/Post');

const BASE_URL = process.env.PUBLIC_WEB_URL || 'https://bideo.in';
const PLAY_STORE_URL =
  process.env.PLAY_STORE_URL ||
  'https://play.google.com/store/apps/details?id=com.farhan.bideoapp';
const APP_PACKAGE = 'com.farhan.bideoapp';
const DEFAULT_SHARE_IMAGE = 'https://play-lh.googleusercontent.com/IG8UtEAD8gMWrdjAt8_LR4JDoofZVXM-A99932YQBhc16nO0KAcIxqb35MAJgP-DSuKXo6G9E3NkqtEqZNiI5Q4=w480-h960-rw';

const RELATED_LIMIT = 6;
const CHANNEL_VIDEOS_LIMIT = 12;
const MAX_TAGS = 10;
const MAX_BODY_DESCRIPTION = 1000;

// Public videos shown as internal links on video/channel pages (indexed by owner).
async function findChannelVideos(ownerId, excludeId, limit) {
  if (!ownerId) return [];
  const filter = { owner: ownerId, visibility: 'public' };
  if (excludeId) filter._id = { $ne: excludeId };
  const rows = await Video.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('title thumbnail')
    .lean();
  return rows.map((v) => ({
    url: `${BASE_URL}/v/${v._id}`,
    title: v.title || 'Bideo video',
    thumbnail: resolveMediaUrl(v.thumbnail),
  }));
}

const cleanTags = (tags) =>
  (Array.isArray(tags) ? tags : [])
    .map((t) => String(t || '').replace(/^#/, '').trim())
    .filter(Boolean)
    .slice(0, MAX_TAGS);

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
  return /google|bot|crawler|spider|inspectiontool|lighthouse|mediapartners|adsbot|feedfetcher|facebookexternalhit|whatsapp|telegram|twitter|slack|discord|linkedin|pinterest|applebot|bingbot|meta|instagram|snapchat|skype|viber/i.test(
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
  duration = 0,
  uploadDate = null,
  isShort = false,
  bodyDescription = '',
  tags = [],
  creatorUrl = '',
  related = [],
  relatedTitle = '',
}) {
  const cleanHeadTitle = String(title || '').toLowerCase().includes('bideo')
    ? title
    : `${title} - Bideo App`;

  const fallbackThumb = DEFAULT_SHARE_IMAGE;
  const displayImage = imageUrl || fallbackThumb;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>${escapeHtml(cleanHeadTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonicalUrl}">
  <meta name="robots" content="index, follow, max-image-preview:large">

  <!-- OpenGraph / Facebook / WhatsApp -->
  <meta property="og:site_name" content="Bideo App">
  <meta property="og:type" content="${ogType}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonicalUrl}">
  ${displayImage ? `
  <meta property="og:image" content="${displayImage}">
  <meta property="og:image:secure_url" content="${displayImage}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1280">
  <meta property="og:image:height" content="720">
  <meta property="og:image:alt" content="${escapeHtml(title)}">
  ` : ''}

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@BideoApp">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  ${displayImage ? `<meta name="twitter:image" content="${displayImage}">` : ''}
  <meta name="twitter:app:name:googleplay" content="Bideo App">
  <meta name="twitter:app:id:googleplay" content="${APP_PACKAGE}">
  <meta name="twitter:app:url:googleplay" content="${deepLink}">

  <!-- Android Deep Link Metadata -->
  <meta property="al:android:url" content="${deepLink}">
  <meta property="al:android:app_name" content="Bideo">
  <meta property="al:android:package" content="${APP_PACKAGE}">
  <meta property="al:web:url" content="${canonicalUrl}">

  ${ogType === 'video.other' ? `
  <!-- Schema.org VideoObject for Google Search & Video Rich Results -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": "${escapeJson(title)}",
    "description": "${escapeJson(description)}",
    "thumbnailUrl": ["${displayImage}"],
    "uploadDate": "${new Date(uploadDate || Date.now()).toISOString()}",
    "duration": "${formatIsoDuration(duration)}",
    "contentUrl": "${videoUrl || canonicalUrl}",
    "embedUrl": "${canonicalUrl}",
    "author": {
      "@type": "Person",
      "name": "${escapeJson(creatorName || 'Bideo Creator')}"
    }
  }
  </script>
  ` : ''}

  ${ogType === 'profile' ? `
  <!-- Schema.org ProfilePage & Person for Google Search -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "name": "${escapeJson(title)}",
    "mainEntity": {
      "@type": "Person",
      "name": "${escapeJson(creatorName || 'Bideo Creator')}",
      "url": "${canonicalUrl}",
      "image": "${displayImage}"
    }
  }
  </script>
  ` : ''}

  ${!isCrawlerReq ? `
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-9RWMB59HW1"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-9RWMB59HW1');
  </script>
  ` : ''}

  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0B0B0E;
      color: #FFFFFF;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px 16px;
      text-align: center;
    }
    .container {
      width: 100%;
      max-width: 440px;
      background: #16161C;
      border: 1px solid #272730;
      border-radius: 20px;
      padding: 24px 20px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .header-logo {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 20px;
      font-weight: 800;
      color: #FFFFFF;
      margin-bottom: 20px;
      text-decoration: none;
    }
    .header-logo span {
      color: #FF7A00;
    }
    .thumb-wrap {
      width: 100%;
      aspect-ratio: 16 / 9;
      background: #000;
      border-radius: 14px;
      overflow: hidden;
      position: relative;
      margin-bottom: 16px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.4);
    }
    .thumb-wrap img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .play-badge {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: rgba(255, 122, 0, 0.92);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 18px rgba(255, 122, 0, 0.5);
    }
    .play-badge svg {
      width: 24px;
      height: 24px;
      fill: #FFF;
      margin-left: 3px;
    }
    .title {
      font-size: 16px;
      font-weight: 700;
      line-height: 1.4;
      color: #F3F4F6;
      margin-bottom: 8px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-align: left;
      width: 100%;
    }
    .creator-row {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      margin-bottom: 22px;
    }
    .creator-name {
      font-size: 13px;
      color: #9CA3AF;
      font-weight: 500;
    }
    .btn-open {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      background: linear-gradient(135deg, #FF7A00 0%, #FF5500 100%);
      color: #FFFFFF;
      text-decoration: none;
      font-size: 16px;
      font-weight: 700;
      padding: 15px 20px;
      border-radius: 14px;
      box-shadow: 0 6px 20px rgba(255, 122, 0, 0.35);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      cursor: pointer;
    }
    .btn-open:active {
      transform: scale(0.98);
    }
    .btn-store {
      display: block;
      width: 100%;
      background: #23232C;
      color: #D1D5DB;
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
      padding: 12px 16px;
      border-radius: 12px;
      margin-top: 10px;
      border: 1px solid #32323D;
      transition: background 0.15s ease;
    }
    .btn-store:hover {
      background: #2D2D38;
      color: #FFFFFF;
    }
    .hint-text {
      font-size: 11px;
      color: #6B7280;
      margin-top: 14px;
    }
    .thumb-wrap.is-short {
      aspect-ratio: 9 / 16;
      max-height: 70vh;
      width: auto;
      max-width: 100%;
      margin-left: auto;
      margin-right: auto;
    }
    .thumb-wrap video {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000;
      display: block;
    }
    a.creator-name {
      color: #E5E7EB;
      text-decoration: none;
      font-weight: 600;
    }
    a.creator-name:hover { color: #FF7A00; }
    .desc {
      width: 100%;
      text-align: left;
      font-size: 13px;
      line-height: 1.55;
      color: #C4C7CE;
      white-space: pre-line;
      word-break: break-word;
      margin: -10px 0 14px;
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      width: 100%;
      margin-bottom: 18px;
    }
    .tag {
      font-size: 11px;
      color: #FFB066;
      background: rgba(255, 122, 0, 0.1);
      border: 1px solid rgba(255, 122, 0, 0.25);
      border-radius: 999px;
      padding: 3px 9px;
    }
    .related {
      width: 100%;
      margin-top: 22px;
      text-align: left;
    }
    .related h2 {
      font-size: 14px;
      font-weight: 700;
      color: #F3F4F6;
      margin-bottom: 10px;
    }
    .related-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .related-item {
      color: #D1D5DB;
      text-decoration: none;
      font-size: 12px;
      line-height: 1.35;
    }
    .related-item img {
      width: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border-radius: 10px;
      background: #000;
      display: block;
      margin-bottom: 6px;
    }
    .related-item span {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  </style>
</head>
<body>
  <div class="container">
    <a href="${BASE_URL}/" class="header-logo">
      <span>▶</span> Bideo
    </a>

    ${ogType === 'video.other' && videoUrl ? `
    <div class="thumb-wrap${isShort ? ' is-short' : ''}">
      <video controls playsinline preload="none" poster="${escapeHtml(displayImage)}" src="${escapeHtml(videoUrl)}" title="${escapeHtml(title)}"></video>
    </div>` : `
    <div class="thumb-wrap">
      <img src="${escapeHtml(displayImage)}" alt="${escapeHtml(title)}" loading="eager" />
      <div class="play-badge">
        <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
      </div>
    </div>`}

    <h1 class="title">${escapeHtml(title)}</h1>
    <div class="creator-row">
      ${creatorUrl
        ? `<a class="creator-name" href="${escapeHtml(creatorUrl)}">${escapeHtml(creatorName || 'Bideo Creator')}</a>`
        : `<span class="creator-name">${escapeHtml(creatorName || 'Bideo Creator')}</span>`}
    </div>
    ${bodyDescription ? `<p class="desc">${escapeHtml(bodyDescription)}</p>` : ''}
    ${tags.length ? `<div class="tags">${tags.map((t) => `<span class="tag">#${escapeHtml(t)}</span>`).join('')}</div>` : ''}

    <a id="open-app-btn" href="${intentLink}" class="btn-open">
      Open in Bideo App
    </a>

    <a href="${PLAY_STORE_URL}" class="btn-store">
      Install from Google Play
    </a>

    <p id="status-hint" class="hint-text">Opening Bideo App... Tap button above if not opened.</p>

    ${related.length ? `
    <section class="related">
      <h2>${escapeHtml(relatedTitle || 'More videos')}</h2>
      <div class="related-grid">
        ${related.map((r) => `<a class="related-item" href="${escapeHtml(r.url)}"><img src="${escapeHtml(r.thumbnail || DEFAULT_SHARE_IMAGE)}" alt="${escapeHtml(r.title)}" loading="lazy" /><span>${escapeHtml(r.title)}</span></a>`).join('')}
      </div>
    </section>` : ''}
  </div>

  ${!isCrawlerReq ? `
  <script>
    (function() {
      var ua = navigator.userAgent || '';
      var isAndroid = /android/i.test(ua);
      var intentUrl = "${intentLink}";
      var playStoreUrl = "${PLAY_STORE_URL}";
      var btn = document.getElementById('open-app-btn');

      if (isAndroid) {
        if (btn) btn.href = intentUrl;
        // Automatic launch attempt on load
        try {
          window.location.href = intentUrl;
        } catch (e) {}
      } else {
        // Desktop and iPhone (Android-only app): stay on the page, link to Google Play
        if (btn) {
          btn.href = playStoreUrl;
          btn.innerText = 'Get on Google Play';
        }
        var hint = document.getElementById('status-hint');
        if (hint) hint.style.display = 'none';
      }
    })();
  </script>
  ` : ''}
</body>
</html>`;
}

// Sitemaps are cached in memory for 1 hour (per file)
const SITEMAP_TTL_MS = 60 * 60 * 1000;
const VIDEOS_PER_SITEMAP = 5000;
const sitemapCache = new Map();

const cachedXml = async (key, build) => {
  const hit = sitemapCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.xml;
  const xml = await build();
  sitemapCache.set(key, { xml, expiresAt: Date.now() + SITEMAP_TTL_MS });
  return xml;
};

const isoDate = (d) => new Date(d || Date.now()).toISOString();
const PUBLIC_VIDEO_FILTER = { visibility: 'public', isBlocked: { $ne: true } };

const STATIC_PAGES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/about', priority: '0.8', changefreq: 'monthly' },
  { path: '/creators', priority: '0.9', changefreq: 'weekly' },
  { path: '/faq', priority: '0.8', changefreq: 'weekly' },
  { path: '/contact', priority: '0.8', changefreq: 'monthly' },
  { path: '/terms', priority: '0.5', changefreq: 'monthly' },
  { path: '/privacy', priority: '0.5', changefreq: 'monthly' },
  { path: '/guidelines', priority: '0.6', changefreq: 'monthly' },
  { path: '/copyright', priority: '0.5', changefreq: 'monthly' },
  { path: '/moderation', priority: '0.5', changefreq: 'monthly' },
  { path: '/cookies', priority: '0.4', changefreq: 'monthly' },
  { path: '/account-deletion', priority: '0.4', changefreq: 'monthly' },
  { path: '/child-safety', priority: '0.5', changefreq: 'monthly' },
  { path: '/refunds', priority: '0.4', changefreq: 'monthly' },
];

const urlset = (body, withVideo = false) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${withVideo ? `
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"` : ''}>${body}
</urlset>`;

const buildPagesSitemap = () =>
  urlset(STATIC_PAGES.map((page) => `
  <url>
    <loc>${BASE_URL}${page.path}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join(''));

const buildVideosSitemap = async (part) => {
  const videos = await Video.find(PUBLIC_VIDEO_FILTER)
    .sort({ _id: 1 })
    .skip((part - 1) * VIDEOS_PER_SITEMAP)
    .limit(VIDEOS_PER_SITEMAP)
    .select('title description thumbnail videoUrl views createdAt duration')
    .lean();
  return urlset(videos.map((v) => `
  <url>
    <loc>${BASE_URL}/v/${v._id}</loc>
    <lastmod>${isoDate(v.createdAt)}</lastmod>
    <video:video>
      <video:thumbnail_loc>${escapeHtml(resolveMediaUrl(v.thumbnail))}</video:thumbnail_loc>
      <video:title>${escapeHtml(v.title || 'Bideo Video')}</video:title>
      <video:description>${escapeHtml(v.description || v.title || 'Watch on Bideo')}</video:description>
      <video:content_loc>${escapeHtml(resolveMediaUrl(v.videoUrl))}</video:content_loc>
      <video:publication_date>${isoDate(v.createdAt)}</video:publication_date>
      <video:duration>${Math.max(1, Math.round(Number(v.duration || 0)))}</video:duration>
      <video:view_count>${v.views || 0}</video:view_count>
      <video:family_friendly>yes</video:family_friendly>
    </video:video>
  </url>`).join(''), true);
};

// Only channels that have at least one public video (empty profiles are thin pages).
const buildChannelsSitemap = async () => {
  const ownerIds = await Video.distinct('owner', PUBLIC_VIDEO_FILTER);
  const channels = await User.find({ _id: { $in: ownerIds }, isBlocked: { $ne: true } })
    .select('_id updatedAt')
    .lean();
  return urlset(channels.map((ch) => `
  <url>
    <loc>${BASE_URL}/c/${ch._id}</loc>
    <lastmod>${isoDate(ch.updatedAt)}</lastmod>
  </url>`).join(''));
};

const buildPostsSitemap = async () => {
  const posts = await Post.find({ visibility: 'public' }).sort({ _id: 1 }).select('_id createdAt').lean();
  return urlset(posts.map((p) => `
  <url>
    <loc>${BASE_URL}/p/${p._id}</loc>
    <lastmod>${isoDate(p.createdAt)}</lastmod>
  </url>`).join(''));
};

const buildSitemapIndex = async () => {
  const videoCount = await Video.countDocuments(PUBLIC_VIDEO_FILTER);
  const videoParts = Math.max(1, Math.ceil(videoCount / VIDEOS_PER_SITEMAP));
  const files = ['sitemap-pages.xml', 'sitemap-channels.xml', 'sitemap-posts.xml'];
  for (let i = 1; i <= videoParts; i += 1) files.push(`sitemap-videos-${i}.xml`);
  const now = isoDate();
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${files.map((f) => `
  <sitemap>
    <loc>${BASE_URL}/${f}</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`).join('')}
</sitemapindex>`;
};

const sendXml = (res, xml) => {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).send(xml);
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
    const thumbnailUrl = resolveMediaUrl(video.thumbnail) || DEFAULT_SHARE_IMAGE;
    const videoUrl = resolveMediaUrl(video.videoUrl);
    const canonicalUrl = `${BASE_URL}/v/${video._id}`;
    const channelName = video.owner?.channelName || video.owner?.name || 'Bideo Creator';
    const channelAvatar = resolveMediaUrl(video.owner?.avatar) || DEFAULT_SHARE_IMAGE;
    const deepLink = `bideo://video/${video._id}`;
    const intentLink = `intent://video/${video._id}#Intent;scheme=bideo;package=${APP_PACKAGE};S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};end`;
    const isCrawlerReq = isCrawler(req.headers['user-agent']);
    const related = await findChannelVideos(video.owner?._id, video._id, RELATED_LIMIT);

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
      duration: video.duration,
      uploadDate: video.createdAt,
      isShort: Boolean(video.isShort),
      bodyDescription: (video.description || '').trim().slice(0, MAX_BODY_DESCRIPTION),
      tags: cleanTags(video.tags),
      creatorUrl: video.owner?._id ? `${BASE_URL}/c/${video.owner._id}` : '',
      related,
      relatedTitle: `More from ${channelName}`,
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
    const avatar = resolveMediaUrl(channel.avatar) || DEFAULT_SHARE_IMAGE;
    const canonicalUrl = `${BASE_URL}/c/${channel._id}`;
    const deepLink = `bideo://channel/${channel._id}`;
    const intentLink = `intent://channel/${channel._id}#Intent;scheme=bideo;package=${APP_PACKAGE};S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};end`;
    const isCrawlerReq = isCrawler(req.headers['user-agent']);
    const latestVideos = await findChannelVideos(channel._id, null, CHANNEL_VIDEOS_LIMIT);

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
      bodyDescription: (channel.about || '').trim().slice(0, MAX_BODY_DESCRIPTION),
      related: latestVideos,
      relatedTitle: `Latest videos from ${channelName}`,
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
    const channelAvatar = resolveMediaUrl(post.owner?.avatar) || DEFAULT_SHARE_IMAGE;
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
      bodyDescription: (post.text || '').trim().slice(0, MAX_BODY_DESCRIPTION),
      creatorUrl: post.owner?._id ? `${BASE_URL}/c/${post.owner._id}` : '',
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (err) {
    next(err);
  }
};

// @desc    Sitemap index pointing to the page, channel, post and video sitemaps
// @route   GET /sitemap.xml and /api/sitemap.xml
// @access  Public
exports.getSitemap = async (req, res, next) => {
  try {
    sendXml(res, await cachedXml('index', buildSitemapIndex));
  } catch (err) {
    next(err);
  }
};

// @desc    One sitemap file: pages, channels, posts or videos-N
// @route   GET /sitemap-<part>.xml and /sitemap-videos-<n>.xml
// @access  Public
exports.getSitemapPart = async (req, res, next) => {
  try {
    const [kind, numberStr] = [req.params[0], req.params[1]];
    if (kind === 'pages' && !numberStr) return sendXml(res, await cachedXml('pages', async () => buildPagesSitemap()));
    if (kind === 'channels' && !numberStr) return sendXml(res, await cachedXml('channels', buildChannelsSitemap));
    if (kind === 'posts' && !numberStr) return sendXml(res, await cachedXml('posts', buildPostsSitemap));
    const part = parseInt(numberStr, 10);
    if (kind === 'videos' && part >= 1) {
      const xml = await cachedXml(`videos-${part}`, () => buildVideosSitemap(part));
      if (part > 1 && !xml.includes('<url>')) return res.status(404).type('text/plain').send('Sitemap not found');
      return sendXml(res, xml);
    }
    return res.status(404).type('text/plain').send('Sitemap not found');
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
    'B3:A1:30:B7:6F:0F:CB:DE:3B:BF:A9:5E:64:A8:B5:5E:E6:7D:6F:54:AF:46:81:17:1A:AF:F4:51:92:A8:4B:CE,32:53:A0:82:A7:36:DB:97:00:8F:CC:1A:44:CB:25:00:33:61:9B:6D:3A:CC:A0:55:37:93:40:E2:FF:7C:73:9A,14:6D:E9:7D:0F:52:AB:F9:EE:4B:E4:36:9C:2C:19:D4:58:62:3B:5A:F3:11:79:2E:39:69:BD:24:D1:D7:9F:DF,FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C'
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

// @desc    Standard plain-text summary for AI assistants (ChatGPT, Perplexity, Claude, Gemini)
// @route   GET /llms.txt and /api/llms.txt
// @access  Public
exports.getLlmsTxt = (req, res) => {
  const content = `# Bideo (bideo.in)
> Watch. Create. Grow. India's modern short & long video sharing platform.

## About Bideo
Bideo is a fast-growing, free video sharing community designed for Indian creators and audiences across Hindi, Bhojpuri, Tamil, Telugu, and other regional languages.
Creators can publish short and long videos, build their channel follower base, and participate in the creator monetization program.

## Mobile Application
- App name on Google Play: Bideo - India's Video Platform
- Platform: Android (free)
- Package ID: com.farhan.bideoapp
- Google Play Store: https://play.google.com/store/apps/details?id=com.farhan.bideoapp
- Website: https://bideo.in

## Official Links & Policies
- About Us: https://bideo.in/about
- For Creators: https://bideo.in/creators
- Frequently Asked Questions: https://bideo.in/faq
- Terms of Service: https://bideo.in/terms
- Privacy Policy: https://bideo.in/privacy
- Community Guidelines: https://bideo.in/guidelines
- Content Moderation: https://bideo.in/moderation
- Copyright Policy: https://bideo.in/copyright
- Account Deletion: https://bideo.in/account-deletion
- Contact & Grievance Redressal: https://bideo.in/contact
`;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.status(200).send(content);
};

