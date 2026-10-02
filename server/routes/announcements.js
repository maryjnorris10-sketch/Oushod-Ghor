const express = require('express');
const Announcement = require('../models/Announcement');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  const list = await Announcement.find({ active: true }).sort({ createdAt: -1 });
  res.json(list);
});

router.get('/admin', adminAuth, async (req, res) => {
  const list = await Announcement.find().sort({ createdAt: -1 });
  res.json(list);
});

router.post('/', adminAuth, async (req, res) => {
  const item = await Announcement.create(req.body);
  res.status(201).json(item);
});

router.put('/:id', adminAuth, async (req, res) => {
  const item = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!item) return res.status(404).json({ message: 'পাওয়া যায়নি' });
  res.json(item);
});

router.delete('/:id', adminAuth, async (req, res) => {
  const item = await Announcement.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ message: 'পাওয়া যায়নি' });
  res.json({ message: 'ডিলিট হয়েছে' });
});

module.exports = router;
