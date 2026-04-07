const mongoose = require('mongoose');

const triageSettingSchema = new mongoose.Schema({
  department: { type: String, required: true },
  score: { type: Number, default: 1.0 },
  votes: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TriageSetting', triageSettingSchema);
