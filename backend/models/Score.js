const mongoose = require('mongoose');

const ScoreSchema = new mongoose.Schema({
  username: { type: String, required: true },
  score: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Score', ScoreSchema);
