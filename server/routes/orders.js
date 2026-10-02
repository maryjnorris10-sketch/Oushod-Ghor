const express = require('express');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const AppSettings = require('../models/AppSettings');
const { customerAuth, adminAuth, flexibleAuth } = require('../middleware/auth');

const router = express.Router();

function generateOrderNo() {
  const date = new Date();
  const stamp = date.toISOString().slice(2, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `OG-${stamp}-${rand}`;
}

// POST /api/orders  (customer places order)
// body: { items: [{ productId, qty }], note, deliveryAddress }
router.post('/', customerAuth, async (req, res) => {
  try {
    const settings = await AppSettings.findOne({ key: 'main' });
    if (settings && settings.appEnabled === false) {
      return res.status(403).json({ message: settings.appDisabledMessage || 'অ্যাপ বন্ধ আছে, এখন অর্ডার করা যাবে না' });
    }

    const { items, note, deliveryAddress } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'কার্টে কোনো পণ্য নেই' });
    }

    const orderItems = [];
    let total = 0;

    for (const it of items) {
      const product = await Product.findById(it.productId);
      if (!product || !product.active) {
        return res.status(400).json({ message: `পণ্য পাওয়া যায়নি: ${it.productId}` });
      }
      if (!product.inStock || product.stock < it.qty) {
        return res.status(400).json({ message: `${product.name} - পর্যাপ্ত স্টক নেই` });
      }
      const qty = Math.max(1, parseInt(it.qty, 10) || 1);
      orderItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        mrp: product.mrp,
        category: product.category,
        form: product.form,
        qty,
        unit: product.unit,
      });
      total += product.price * qty;
    }

    const minOrderAmount = (settings && settings.minOrderAmount) || 500;
    if (total < minOrderAmount) {
      return res.status(400).json({ message: `সর্বনিম্ন অর্ডার মূল্য ৳${minOrderAmount} — বর্তমান মোট ৳${total}` });
    }

    const order = await Order.create({
      orderNo: generateOrderNo(),
      customer: req.customer._id,
      items: orderItems,
      total,
      note: note || '',
      deliveryAddress: deliveryAddress || req.customer.address,
      statusHistory: [{ status: 'pending' }],
    });

    for (const it of orderItems) {
      await Product.findByIdAndUpdate(it.product, { $inc: { stock: -it.qty } });
    }

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ message: 'অর্ডার করা যায়নি', error: err.message });
  }
});

// POST /api/orders/admin-create  (admin places an order on behalf of a customer —
// e.g. the customer called in but doesn't have their phone/app on hand)
// body: { customerId, items: [{ productId, qty }], note, deliveryAddress }
router.post('/admin-create', adminAuth, async (req, res) => {
  try {
    const { customerId, items, note, deliveryAddress } = req.body;
    if (!customerId) {
      return res.status(400).json({ message: 'কাস্টমার বেছে নিন' });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ message: 'কাস্টমার পাওয়া যায়নি' });
    if (customer.status === 'blocked') {
      return res.status(400).json({ message: 'এই কাস্টমার ব্লকড, তার হয়ে অর্ডার তৈরি করা যাবে না' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'কার্টে কোনো পণ্য নেই' });
    }

    const orderItems = [];
    let total = 0;

    for (const it of items) {
      const product = await Product.findById(it.productId);
      if (!product || !product.active) {
        return res.status(400).json({ message: `পণ্য পাওয়া যায়নি: ${it.productId}` });
      }
      const qty = Math.max(1, parseInt(it.qty, 10) || 1);
      if (!product.inStock || product.stock < qty) {
        return res.status(400).json({ message: `${product.name} - পর্যাপ্ত স্টক নেই` });
      }
      orderItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        mrp: product.mrp,
        category: product.category,
        form: product.form,
        qty,
        unit: product.unit,
      });
      total += product.price * qty;
    }

    // Admin-created orders skip the "app disabled" and minimum-order-amount
    // checks — the admin is fulfilling a call-in/walk-in customer directly
    // and should have full control regardless of storefront restrictions.
    const order = await Order.create({
      orderNo: generateOrderNo(),
      customer: customer._id,
      items: orderItems,
      total,
      note: note || '',
      deliveryAddress: deliveryAddress || customer.address,
      createdByAdmin: true,
      statusHistory: [{ status: 'pending' }],
    });

    for (const it of orderItems) {
      await Product.findByIdAndUpdate(it.product, { $inc: { stock: -it.qty } });
    }

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ message: 'অর্ডার তৈরি করা যায়নি', error: err.message });
  }
});

// GET /api/orders/mine (customer's own orders)
router.get('/mine', customerAuth, async (req, res) => {
  const orders = await Order.find({ customer: req.customer._id }).sort({ createdAt: -1 }).lean();
  res.json(orders);
});

// GET /api/orders (admin - all orders, optional ?status=)
router.get('/', adminAuth, async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const orders = await Order.find(filter)
    .populate('customer', 'pharmacyName ownerName phone area')
    .sort({ createdAt: -1 })
    .lean();
  res.json(orders);
});

// GET /api/orders/:id  (admin can view any order; customer can view only their own)
router.get('/:id', flexibleAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      'customer',
      'pharmacyName ownerName phone area address'
    );
    if (!order) return res.status(404).json({ message: 'অর্ডার পাওয়া যায়নি' });
    if (req.role === 'customer' && String(order.customer._id) !== String(req.customer._id)) {
      return res.status(403).json({ message: 'অনুমতি নেই' });
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: 'সার্ভার সমস্যা', error: err.message });
  }
});

// PUT /api/orders/:id/edit  (customer edits their own order while pending; admin can edit any order any time)
// body: { items: [{ productId, qty }], note, deliveryAddress }
router.put('/:id/edit', flexibleAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'অর্ডার পাওয়া যায়নি' });

    if (req.role === 'customer') {
      if (String(order.customer) !== String(req.customer._id)) {
        return res.status(403).json({ message: 'অনুমতি নেই' });
      }
      if (order.status !== 'pending') {
        return res.status(400).json({ message: 'শুধুমাত্র পেন্ডিং অর্ডার সম্পাদনা করা যায়' });
      }
    }
    // admin can edit an order at any status — no ownership/status restriction

    const { items, note, deliveryAddress } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'অর্ডারে কমপক্ষে একটি পণ্য থাকতে হবে' });
    }

    // Release the stock this order currently holds, so we can re-validate
    // against fresh availability for the edited quantities.
    for (const it of order.items) {
      await Product.findByIdAndUpdate(it.product, { $inc: { stock: it.qty } });
    }

    const newItems = [];
    let total = 0;
    for (const it of items) {
      const product = await Product.findById(it.productId);
      const qty = Math.max(1, parseInt(it.qty, 10) || 1);
      if (!product || !product.active || !product.inStock || product.stock < qty) {
        // Roll back the release above so stock stays consistent, then fail.
        for (const oi of order.items) {
          await Product.findByIdAndUpdate(oi.product, { $inc: { stock: -oi.qty } });
        }
        return res.status(400).json({
          message: !product ? 'একটি পণ্য আর পাওয়া যাচ্ছে না' : `${product.name} - পর্যাপ্ত স্টক নেই`,
        });
      }
      newItems.push({ product: product._id, name: product.name, price: product.price, mrp: product.mrp, category: product.category, form: product.form, qty, unit: product.unit });
      total += product.price * qty;
    }

    for (const it of newItems) {
      await Product.findByIdAndUpdate(it.product, { $inc: { stock: -it.qty } });
    }

    const settings = await AppSettings.findOne({ key: 'main' });
    const minOrderAmount = (settings && settings.minOrderAmount) || 500;
    if (total < minOrderAmount) {
      // Roll back: undo the new decrement and restore the original items' stock.
      for (const it of newItems) {
        await Product.findByIdAndUpdate(it.product, { $inc: { stock: it.qty } });
      }
      for (const oi of order.items) {
        await Product.findByIdAndUpdate(oi.product, { $inc: { stock: -oi.qty } });
      }
      return res.status(400).json({ message: `সর্বনিম্ন অর্ডার মূল্য ৳${minOrderAmount} — বর্তমান মোট ৳${total}` });
    }

    order.items = newItems;
    order.total = total;
    if (note !== undefined) order.note = note;
    if (deliveryAddress !== undefined) order.deliveryAddress = deliveryAddress;
    await order.save();
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: 'অর্ডার সম্পাদনা করা যায়নি', error: err.message });
  }
});

// PATCH /api/orders/:id/cancel  (customer cancels their own order — only while it's still pending)
router.patch('/:id/cancel', customerAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'অর্ডার পাওয়া যায়নি' });
    if (String(order.customer) !== String(req.customer._id)) {
      return res.status(403).json({ message: 'অনুমতি নেই' });
    }
    if (order.status !== 'pending') {
      return res.status(400).json({ message: 'শুধুমাত্র পেন্ডিং অর্ডার বাতিল করা যায়। বাতিল করতে চাইলে হটলাইনে যোগাযোগ করুন।' });
    }
    for (const it of order.items) {
      await Product.findByIdAndUpdate(it.product, { $inc: { stock: it.qty } });
    }
    order.status = 'cancelled';
    order.statusHistory.push({ status: 'cancelled' });
    await order.save();
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: 'অর্ডার বাতিল করা যায়নি', error: err.message });
  }
});

// PATCH /api/orders/:id/status (admin only)
router.patch('/:id/status', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ message: 'ভুল স্ট্যাটাস' });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'অর্ডার পাওয়া যায়নি' });

    if (status === 'cancelled' && order.status !== 'cancelled') {
      for (const it of order.items) {
        await Product.findByIdAndUpdate(it.product, { $inc: { stock: it.qty } });
      }
    }

    order.status = status;
    order.statusHistory.push({ status });
    await order.save();
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: 'আপডেট করা যায়নি', error: err.message });
  }
});

module.exports = router;
