const express = require('express');
const Company = require('../models/Company');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  const companies = await Company.find({ active: true }).sort({ name: 1 }).lean();
  res.json(companies);
});

router.post('/', adminAuth, async (req, res) => {
  try {
    const company = await Company.create(req.body);
    res.status(201).json(company);
  } catch (err) {
    res.status(400).json({ message: 'তৈরি করা যায়নি', error: err.message });
  }
});

router.put('/:id', adminAuth, async (req, res) => {
  try {
    const company = await Company.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!company) return res.status(404).json({ message: 'পাওয়া যায়নি' });
    res.json(company);
  } catch (err) {
    res.status(400).json({ message: 'আপডেট করা যায়নি', error: err.message });
  }
});

router.delete('/:id', adminAuth, async (req, res) => {
  const company = await Company.findByIdAndDelete(req.params.id);
  if (!company) return res.status(404).json({ message: 'পাওয়া যায়নি' });
  res.json({ message: 'ডিলিট হয়েছে' });
});

module.exports = router;
