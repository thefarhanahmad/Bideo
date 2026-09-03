const express = require('express');
const {
  getVideoPage,
  getChannelPage,
  getSitemap,
  getRobots,
  getAssetLinks,
} = require('../controllers/seo');

const router = express.Router();

router.get(['/v/:id', '/video/:id', '/watch/:id'], getVideoPage);
router.get(['/c/:id', '/channel/:id'], getChannelPage);
router.get('/sitemap.xml', getSitemap);
router.get('/robots.txt', getRobots);
router.get('/.well-known/assetlinks.json', getAssetLinks);

module.exports = router;
