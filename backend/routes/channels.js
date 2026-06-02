const express = require('express');
const { getChannelProfile } = require('../controllers/users');
const { softProtect } = require('../middlewares/auth');

const router = express.Router();

router.get('/:id', softProtect, getChannelProfile);

module.exports = router;
