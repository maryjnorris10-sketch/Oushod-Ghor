const express = require('express');
const Notification = require('../models/Notification');
const { customerAuthAny } = require('../middleware/auth');

const router = express.Router();

router.get('/', customerAuthAny, async (req, res) => {
  const list = await Notification.find({ customer: req.customer._id }).sort({ createdAt: -1 });
  res.json(list);
});

router.patch('/:id/read', customerAuthAny, async (req, res) => {
  const item = await Notification.findOneAndUpdate(
    { _id: req.params.id, customer: req.customer._id },
    { read: true },
    { new: true }
  );
  if (!item) return res.status(404).json({ message: 'পাওয়া যায়নি' });
  res.json(item);
});

module.exports = router;
