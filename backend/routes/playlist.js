const express = require('express');
const {
  createPlaylist,
  getPlaylists,
  addVideoToPlaylist,
} = require('../controllers/playlist');
const { protect } = require('../middlewares/auth');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getPlaylists)
  .post(createPlaylist);

router.put('/:id/add', addVideoToPlaylist);

module.exports = router;
