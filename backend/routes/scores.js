const express = require('express');
const Score = require('../models/Score');
const router = express.Router();

router.post('/submit', async (req, res) => {
  try {
    const { username, score } = req.body;
    if (!username || score === undefined) return res.status(400).json({ error: 'Missing data' });

    const newScore = new Score({ username, score });
    await newScore.save();
    res.status(201).json({ message: 'Score saved' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/top', async (req, res) => {
  try {
    const topScores = await Score.find().sort({ score: -1 }).limit(10);
    res.json(topScores);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
