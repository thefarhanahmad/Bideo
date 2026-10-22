const express = require('express');
const {
  createPlaylist,
  getPlaylists,
  addVideoToPlaylist,
  getPlaylist,
  getChannelPlaylists,
  updatePlaylist,
  deletePlaylist,
  removeVideoFromPlaylist,
} = require('../controllers/playlist');
const { protect, softProtect } = require('../middlewares/auth');

const router = express.Router();

// Public reads (private playlists are only returned to their owner)
router.get('/channel/:userId', softProtect, getChannelPlaylists);
router.get('/:id', softProtect, getPlaylist);

router.use(protect);

router.route('/')
  .get(getPlaylists)
  .post(createPlaylist);

router.route('/:id')
  .put(updatePlaylist)
  .delete(deletePlaylist);

router.put('/:id/add', addVideoToPlaylist);
router.delete('/:id/videos/:videoId', removeVideoFromPlaylist);

module.exports = router;
