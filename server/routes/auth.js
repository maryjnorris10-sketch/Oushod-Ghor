const express = require('express');
const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');
const Admin = require('../models/Admin');
const { customerAuthAny } = require('../middleware/auth');

const router = express.Router();

function signToken(id, role) {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

// POST /api/auth/register  (customer signup -> goes to "pending" for admin approval)
router.post('/register', async (req, res) => {
  try {
    const { pharmacyName, ownerName, phone, password, address, area, tradeLicense } = req.body;
    if (!pharmacyName || !ownerName || !phone || !password) {
      return res.status(400).json({ message: 'সব প্রয়োজনীয় তথ্য দিন' });
    }
    const exists = await Customer.findOne({ phone });
    if (exists) return res.status(400).json({ message: 'এই মোবাইল নম্বর দিয়ে আগে থেকেই অ্যাকাউন্ট আছে' });

    const customer = await Customer.create({
      pharmacyName,
      ownerName,
      phone,
      password,
      address,
      area,
      tradeLicense,
    });

    const token = signToken(customer._id, 'customer');
    res.status(201).json({ token, customer: customer.toSafeObject() });
  } catch (err) {
    res.status(500).json({ message: 'সার্ভার সমস্যা', error: err.message });
  }
});

// POST /api/auth/login — unified login for both customer and admin accounts.
// Checks the customer collection first, then the admin collection, so both
// roles can log in from the same form without picking which panel to use.
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ message: 'ফোন নম্বর ও পাসওয়ার্ড দিন' });

    const customer = await Customer.findOne({ phone });
    if (customer && (await customer.comparePassword(password))) {
      const token = signToken(customer._id, 'customer');
      return res.json({ token, role: 'customer', customer: customer.toSafeObject() });
    }

    const admin = await Admin.findOne({ phone });
    if (admin && (await admin.comparePassword(password))) {
      const token = signToken(admin._id, 'admin');
      return res.json({ token, role: 'admin', admin: { id: admin._id, name: admin.name, phone: admin.phone } });
    }

    return res.status(400).json({ message: 'ফোন নম্বর বা পাসওয়ার্ড ভুল' });
  } catch (err) {
    res.status(500).json({ message: 'সার্ভার সমস্যা', error: err.message });
  }
});

// GET /api/auth/me (customer - works even if pending/blocked, so frontend can show status)
router.get('/me', customerAuthAny, async (req, res) => {
  res.json({ customer: req.customer.toSafeObject() });
});

// POST /api/auth/admin-login
router.post('/admin-login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const admin = await Admin.findOne({ phone });
    if (!admin) return res.status(400).json({ message: 'ফোন নম্বর বা পাসওয়ার্ড ভুল' });
    const ok = await admin.comparePassword(password);
    if (!ok) return res.status(400).json({ message: 'ফোন নম্বর বা পাসওয়ার্ড ভুল' });
    const token = signToken(admin._id, 'admin');
    res.json({ token, admin: { id: admin._id, name: admin.name, phone: admin.phone } });
  } catch (err) {
    res.status(500).json({ message: 'সার্ভার সমস্যা', error: err.message });
  }
});

module.exports = router;
