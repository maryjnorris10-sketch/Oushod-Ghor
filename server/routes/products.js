const express = require('express');
const Product = require('../models/Product');
const Company = require('../models/Company');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/products  -> public list (active only), supports ?q= &category= &company= &page= &limit=
// page/limit are optional — omitting them preserves the old "return everything" behavior
// for callers that need the full catalog (e.g. shop homepage's curated sections).
router.get('/', async (req, res) => {
  try {
    const { q, category, company, page, limit, ids } = req.query;
    const filter = { active: true };
    if (!ids) filter.inStock = true; // browsing/search hides out-of-stock; direct id lookups (cart, recently-purchased) still resolve so the UI can show their actual state
    if (category) filter.category = category;
    if (company) filter.company = company;
    if (q) {
      const safe = String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [{ name: { $regex: safe, $options: 'i' } }, { companyName: { $regex: safe, $options: 'i' } }];
    }
    if (ids) filter._id = { $in: String(ids).split(',').filter(Boolean) };
    let query = Product.find(filter).sort({ createdAt: -1 }).lean();
    let total;
    if (limit) {
      total = await Product.countDocuments(filter);
      const lim = Math.min(Number(limit) || 60, 100);
      const pg = Math.max(Number(page) || 1, 1);
      query = query.skip((pg - 1) * lim).limit(lim);
    }
    const products = await query;
    if (limit) {
      res.json({ items: products, total, page: Number(page) || 1, hasMore: (Number(page) || 1) * Math.min(Number(limit) || 60, 100) < total });
    } else {
      res.json(products);
    }
  } catch (err) {
    res.status(500).json({ message: 'সার্ভার সমস্যা', error: err.message });
  }
});

// GET /api/products/deals?limit=  -> top products by discount percentage (mrp vs price), via aggregation
// so we don't need the full catalog client-side just to find "special offer" items.
router.get('/deals', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 16, 40);
    const deals = await Product.aggregate([
      { $match: { active: true, inStock: true, mrp: { $gt: 0 } } },
      { $addFields: { discountPct: { $multiply: [{ $divide: [{ $subtract: ['$mrp', '$price'] }, '$mrp'] }, 100] } } },
      { $match: { discountPct: { $gt: 0 } } },
      { $sort: { discountPct: -1 } },
      { $limit: limit },
    ]);
    res.json(deals);
  } catch (err) {
    res.status(500).json({ message: 'সার্ভার সমস্যা', error: err.message });
  }
});

// GET /api/products/categories -> distinct category list (for filter chips, avoids loading the full catalog)
router.get('/categories', async (req, res) => {
  try {
    const categories = await Product.distinct('category', { active: true });
    res.json(categories.filter(Boolean).sort());
  } catch (err) {
    res.status(500).json({ message: 'সার্ভার সমস্যা', error: err.message });
  }
});

// GET /api/products/stockout-grouped (admin) -> out-of-stock products grouped by company, with counts
router.get('/stockout-grouped', adminAuth, async (req, res) => {
  try {
    const groups = await Product.aggregate([
      { $match: { inStock: false } },
      {
        $project: {
          _id: 1, name: 1, image: 1, category: 1, companyName: 1, price: 1, stock: 1, inStock: 1,
        },
      },
      {
        $group: {
          _id: { $ifNull: ['$companyName', 'অজানা কোম্পানি'] },
          count: { $sum: 1 },
          products: { $push: '$$ROOT' },
        },
      },
      { $sort: { count: -1 } },
    ]);
    res.json(groups.map((g) => ({ companyName: g._id, count: g.count, products: g.products })));
  } catch (err) {
    res.status(500).json({ message: 'সার্ভার সমস্যা', error: err.message });
  }
});

// GET /api/products/admin -> admin list (paginated), includes inactive
// supports ?q= &page= &limit= &inStock=true|false
router.get('/admin', adminAuth, async (req, res) => {
  try {
    const { q, page, limit, inStock, noImage, exclude } = req.query;
    const filter = {};
    if (q) {
      const safe = String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [{ name: { $regex: safe, $options: 'i' } }, { companyName: { $regex: safe, $options: 'i' } }];
    }
    if (inStock === 'true') filter.inStock = true;
    if (inStock === 'false') filter.inStock = false;
    if (noImage === 'true') filter.$and = [{ $or: [{ image: '' }, { image: { $exists: false } }] }];
    if (exclude) filter._id = { $nin: String(exclude).split(',').filter(Boolean) };

    const lim = Math.min(Number(limit) || 50, 100);
    const pg = Math.max(Number(page) || 1, 1);

    const [items, total, outOfStockCount] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip((pg - 1) * lim).limit(lim).lean(),
      Product.countDocuments(filter),
      Product.countDocuments({ inStock: false }),
    ]);

    res.json({ items, total, page: pg, hasMore: pg * lim < total, outOfStockCount });
  } catch (err) {
    res.status(500).json({ message: 'সার্ভার সমস্যা', error: err.message });
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'প্রোডাক্ট পাওয়া যায়নি' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: 'সার্ভার সমস্যা', error: err.message });
  }
});

// POST /api/products  (admin only)
router.post('/', adminAuth, async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.stock !== undefined && body.inStock === undefined) {
      body.inStock = Number(body.stock) > 0;
    }
    const product = await Product.create(body);
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ message: 'তৈরি করা যায়নি', error: err.message });
  }
});

// PUT /api/products/:id (admin only)
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.stock !== undefined && body.inStock === undefined) {
      body.inStock = Number(body.stock) > 0;
    }
    const product = await Product.findByIdAndUpdate(req.params.id, body, {
      new: true,
      runValidators: true,
    });
    if (!product) return res.status(404).json({ message: 'প্রোডাক্ট পাওয়া যায়নি' });
    res.json(product);
  } catch (err) {
    res.status(400).json({ message: 'আপডেট করা যায়নি', error: err.message });
  }
});

// DELETE /api/products/:id (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'প্রোডাক্ট পাওয়া যায়নি' });
    res.json({ message: 'ডিলিট হয়েছে' });
  } catch (err) {
    res.status(500).json({ message: 'সার্ভার সমস্যা', error: err.message });
  }
});

// PATCH /api/products/:id/stock (admin only) -> toggle in-stock / restock quantity
router.patch('/:id/stock', adminAuth, async (req, res) => {
  try {
    const { stock, inStock, form, image } = req.body;
    const update = {};
    if (stock !== undefined) {
      update.stock = stock;
      if (inStock === undefined) update.inStock = Number(stock) > 0;
    }
    if (inStock !== undefined) update.inStock = inStock;
    if (form !== undefined) update.form = form;
    if (image !== undefined) update.image = image;
    const product = await Product.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!product) return res.status(404).json({ message: 'প্রোডাক্ট পাওয়া যায়নি' });
    res.json(product);
  } catch (err) {
    res.status(400).json({ message: 'আপডেট করা যায়নি', error: err.message });
  }
});

// POST /api/products/bulk-import  (admin only)
// body: { products: [{ name, companyName, category, unit, form, mrp, discountPercent, stock, description }] }
// Auto-creates missing companies, computes price from mrp+discountPercent, and
// skips rows whose name matches an existing product (case-insensitive) so
// re-uploading the same sheet twice doesn't create duplicates.
router.post('/bulk-import', adminAuth, async (req, res) => {
  try {
    const rows = Array.isArray(req.body.products) ? req.body.products : [];
    if (!rows.length) return res.status(400).json({ message: 'কোনো প্রোডাক্ট পাওয়া যায়নি' });

    const companyNames = [...new Set(rows.map((r) => (r.companyName || '').trim()).filter(Boolean))];
    const companyMap = {};
    for (const name of companyNames) {
      let company = await Company.findOne({ name });
      if (!company) company = await Company.create({ name });
      companyMap[name] = company._id;
    }

    const existingNames = new Set(
      (await Product.find({}, 'name')).map((p) => p.name.trim().toLowerCase())
    );

    const docs = [];
    const skipped = [];
    for (const r of rows) {
      const name = (r.name || '').trim();
      if (!name) continue;
      if (existingNames.has(name.toLowerCase())) { skipped.push(name); continue; }
      const mrp = Number(r.mrp) || 0;
      const discountPercent = Number(r.discountPercent) || 0;
      const price = Math.round(mrp * (1 - discountPercent / 100) * 100) / 100;
      const companyName = (r.companyName || '').trim();
      docs.push({
        name,
        company: companyMap[companyName] || undefined,
        companyName,
        category: (r.category || '').trim() || 'সাধারণ',
        unit: (r.unit || '').trim() || 'পিস',
        form: (r.form || '').trim(),
        mrp,
        price,
        stock: Number(r.stock) || 0,
        inStock: (Number(r.stock) || 0) > 0,
        description: (r.description || '').trim(),
      });
      existingNames.add(name.toLowerCase());
    }

    const created = docs.length ? await Product.insertMany(docs, { ordered: false }) : [];
    res.status(201).json({
      createdCount: created.length,
      skippedCount: skipped.length,
      skipped: skipped.slice(0, 30),
    });
  } catch (err) {
    res.status(400).json({ message: 'ইমপোর্ট করা যায়নি', error: err.message });
  }
});
module.exports = router;
