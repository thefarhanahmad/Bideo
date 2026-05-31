const express = require('express');
const { getChannelProfile } = require('../controllers/users');

const router = express.Router();

router.get('/:id', getChannelProfile);

module.exports = router;
