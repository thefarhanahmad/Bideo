const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Video = require('../models/Video');
const User = require('../models/User');

const BASE_URL = 'https://bideo.in';

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function generateSitemap() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const today = new Date().toISOString().split('T')[0];

  const staticPages = [
    { loc: `${BASE_URL}/`, priority: '1.0', changefreq: 'daily' },
    { loc: `${BASE_URL}/download/app`, priority: '0.9', changefreq: 'weekly' },
    { loc: `${BASE_URL}/about`, priority: '0.7', changefreq: 'monthly' },
    { loc: `${BASE_URL}/contact`, priority: '0.6', changefreq: 'monthly' },
    { loc: `${BASE_URL}/privacy`, priority: '0.5', changefreq: 'monthly' },
    { loc: `${BASE_URL}/terms`, priority: '0.5', changefreq: 'monthly' },
    { loc: `${BASE_URL}/guidelines`, priority: '0.5', changefreq: 'monthly' },
    { loc: `${BASE_URL}/child-safety`, priority: '0.5', changefreq: 'monthly' },
    { loc: `${BASE_URL}/copyright`, priority: '0.5', changefreq: 'monthly' },
    { loc: `${BASE_URL}/moderation`, priority: '0.5', changefreq: 'monthly' },
    { loc: `${BASE_URL}/cookies`, priority: '0.4', changefreq: 'monthly' },
    { loc: `${BASE_URL}/refunds`, priority: '0.4', changefreq: 'monthly' },
    { loc: `${BASE_URL}/account-deletion`, priority: '0.4', changefreq: 'monthly' },
  ];

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

  console.log(`Found ${videos.length} videos and ${channels.length} channels.`);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
`;

  // 1. Static Pages
  for (const page of staticPages) {
    xml += `  <url>
    <loc>${page.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>\n`;
  }

  // 2. Video Pages (with VideoObject schema for Google Video Search)
  for (const v of videos) {
    const loc = `${BASE_URL}/v/${v._id}`;
    let thumb = v.thumbnail || 'https://bideo.in/assets/logo.png';
    let contentLoc = v.videoUrl || '';
    const pubDate = new Date(v.createdAt || Date.now()).toISOString();
    const title = escapeXml(v.title || 'Watch on Bideo');
    const desc = escapeXml((v.description || v.title || 'Watch trending video on Bideo').slice(0, 1000));
    const views = Math.max(0, Number(v.views) || 0);

    xml += `  <url>
    <loc>${loc}</loc>
    <video:video>
      <video:thumbnail_loc>${escapeXml(thumb)}</video:thumbnail_loc>
      <video:title>${title}</video:title>
      <video:description>${desc}</video:description>
      ${contentLoc ? `<video:content_loc>${escapeXml(contentLoc)}</video:content_loc>` : ''}
      <video:publication_date>${pubDate}</video:publication_date>
      <video:view_count>${views}</video:view_count>
      <video:family_friendly>yes</video:family_friendly>
    </video:video>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>\n`;
  }

  // 3. Channels
  for (const ch of channels) {
    const loc = `${BASE_URL}/c/${ch._id}`;
    const modDate = (ch.updatedAt ? new Date(ch.updatedAt) : new Date()).toISOString().split('T')[0];
    xml += `  <url>
    <loc>${loc}</loc>
    <lastmod>${modDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>\n`;
  }

  xml += `</urlset>\n`;

  const outputPath = path.resolve(__dirname, '../../adminDashboard/public/sitemap.xml');
  fs.writeFileSync(outputPath, xml, 'utf8');
  console.log(`✅ Successfully generated sitemap at: ${outputPath}`);

  await mongoose.disconnect();
}

generateSitemap().catch(console.error);
