const express = require('express');
const Admin = require('../models/Admin');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/admins (admin only) — list all admin accounts
router.get('/', adminAuth, async (req, res) => {
  try {
    const admins = await Admin.find().select('-password').sort({ createdAt: 1 });
    res.json(admins);
  } catch (err) {
    res.status(500).json({ message: 'সার্ভার সমস্যা', error: err.message });
  }
});

// POST /api/admins (admin only) — create a new admin account
router.post('/', adminAuth, async (req, res) => {
  try {
    const { name, phone, password } = req.body;
    if (!name || !phone || !password) {
      return res.status(400).json({ message: 'নাম, ফোন নম্বর ও পাসওয়ার্ড দিন' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' });
    }
    const exists = await Admin.findOne({ phone });
    if (exists) return res.status(400).json({ message: 'এই ফোন নম্বর দিয়ে আগে থেকেই একটি অ্যাডমিন অ্যাকাউন্ট আছে' });

    const admin = await Admin.create({ name, phone, password });
    res.status(201).json({ id: admin._id, name: admin.name, phone: admin.phone, createdAt: admin.createdAt });
  } catch (err) {
    res.status(500).json({ message: 'অ্যাডমিন তৈরি করা যায়নি', error: err.message });
  }
});

// DELETE /api/admins/:id (admin only) — remove an admin account.
// Guards: can't delete your own account while logged in as it, and the last
// remaining admin account can't be deleted (would lock everyone out).
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    if (String(req.admin._id) === String(req.params.id)) {
      return res.status(400).json({ message: 'নিজের অ্যাকাউন্ট নিজে ডিলিট করা যাবে না' });
    }
    const totalAdmins = await Admin.countDocuments();
    if (totalAdmins <= 1) {
      return res.status(400).json({ message: 'সর্বশেষ অ্যাডমিন অ্যাকাউন্ট ডিলিট করা যাবে না' });
    }
    const admin = await Admin.findByIdAndDelete(req.params.id);
    if (!admin) return res.status(404).json({ message: 'পাওয়া যায়নি' });
    res.json({ message: 'অ্যাডমিন ডিলিট হয়েছে' });
  } catch (err) {
    res.status(500).json({ message: 'সার্ভার সমস্যা', error: err.message });
  }
});

module.exports = router;
