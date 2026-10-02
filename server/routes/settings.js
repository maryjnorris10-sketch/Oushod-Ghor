const express = require('express');
const AppSettings = require('../models/AppSettings');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  let settings = await AppSettings.findOne({ key: 'main' });
  if (!settings) settings = await AppSettings.create({ key: 'main' });
  res.json(settings);
});

router.put('/', adminAuth, async (req, res) => {
  const settings = await AppSettings.findOneAndUpdate(
    { key: 'main' },
    { $set: req.body },
    { new: true, upsert: true, runValidators: true }
  );
  res.json(settings);
});

module.exports = router;
