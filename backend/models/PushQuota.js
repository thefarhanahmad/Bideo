const mongoose = require('mongoose');

// How many "recommended for you" pushes a person got on one IST day.
// _id is "<userId>:<YYYY-MM-DD IST>", so each person has one counter per day; old ones expire.
const pushQuotaSchema = new mongoose.Schema({
  _id: { type: String },
  recommendations: { type: Number, default: 0 },
  expireAt: { type: Date, required: true, expires: 0 },
});

module.exports = mongoose.model('PushQuota', pushQuotaSchema);
