const express = require('express');
const Customer = require('../models/Customer');
const { customerAuthAny, adminAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/customers (admin - list all, optional ?status=)
router.get('/', adminAuth, async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const customers = await Customer.find(filter).select('-password').sort({ createdAt: -1 }).lean();
  res.json(customers);
});

// PATCH /api/customers/:id/status (admin - approve / block / pending)
router.patch('/:id/status', adminAuth, async (req, res) => {
  const { status } = req.body;
  if (!['pending', 'approved', 'blocked'].includes(status)) {
    return res.status(400).json({ message: 'ভুল স্ট্যাটাস' });
  }
  const customer = await Customer.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!customer) return res.status(404).json({ message: 'পাওয়া যায়নি' });
  res.json(customer.toSafeObject());
});

// DELETE /api/customers/:id (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  const customer = await Customer.findByIdAndDelete(req.params.id);
  if (!customer) return res.status(404).json({ message: 'পাওয়া যায়নি' });
  res.json({ message: 'কাস্টমার ডিলিট হয়েছে' });
});

// PUT /api/customers/me (customer edits own profile)
router.put('/me', customerAuthAny, async (req, res) => {
  try {
    const allowed = ['pharmacyName', 'ownerName', 'address', 'area', 'tradeLicense'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    const customer = await Customer.findByIdAndUpdate(req.customer._id, updates, {
      new: true,
      runValidators: true,
    });
    res.json(customer.toSafeObject());
  } catch (err) {
    res.status(400).json({ message: 'আপডেট করা যায়নি', error: err.message });
  }
});

// PUT /api/customers/me/password (customer changes password)
router.put('/me/password', customerAuthAny, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const customer = await Customer.findById(req.customer._id);
    const ok = await customer.comparePassword(currentPassword);
    if (!ok) return res.status(400).json({ message: 'বর্তমান পাসওয়ার্ড সঠিক নয়' });
    customer.password = newPassword;
    await customer.save();
    res.json({ message: 'পাসওয়ার্ড পরিবর্তন হয়েছে' });
  } catch (err) {
    res.status(400).json({ message: 'পরিবর্তন করা যায়নি', error: err.message });
  }
});

// PUT /api/customers/:id (admin - edit any field, including phone/status/password reset)
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const allowed = ['pharmacyName', 'ownerName', 'phone', 'address', 'area', 'tradeLicense', 'status'];
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: 'পাওয়া যায়নি' });

    for (const key of allowed) {
      if (req.body[key] !== undefined) customer[key] = req.body[key];
    }
    if (req.body.password) {
      customer.password = req.body.password; // pre-save hook hashes it
    }
    await customer.save();
    res.json(customer.toSafeObject());
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'এই ফোন নম্বর আগে থেকেই অন্য কাস্টমারের নামে আছে' });
    }
    res.status(400).json({ message: 'আপডেট করা যায়নি', error: err.message });
  }
});

module.exports = router;
