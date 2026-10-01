const express = require('express'), mongoose = require('mongoose'), bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken');
const { MONGO_URI, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, PORT = 3000 } = process.env;
if (!MONGO_URI || !JWT_SECRET || !ADMIN_EMAIL || !ADMIN_PASSWORD) { console.error('MONGO_URI, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD সেট করুন'); process.exit(1); }
const VAT = +(process.env.VAT_PERCENT || 0);
const S = mongoose.Schema, ID = S.Types.ObjectId;
const User = mongoose.model('User', new S({ pharmacyName: String, ownerName: String, email: { type: String, unique: true, lowercase: true, trim: true }, phone: String, address: String, drugLicense: String, tradeLicense: String, creditLimit: { type: Number, default: 0 }, creditDays: { type: Number, default: 30 }, password: String, role: { type: String, default: 'pharmacy' }, status: { type: String, default: 'pending' } }, { timestamps: true }));
const Product = mongoose.model('Product', new S({ name: String, category: String, price: Number, mrp: Number, generic: String, manufacturer: String, group: String, unit: { type: String, default: 'strip' }, moq: { type: Number, default: 1 }, batch: String, expiry: Date, coldChain: Boolean, discount: { type: Number, default: 0 }, bonusBuy: Number, bonusFree: Number, stock: { type: Number, default: 0 }, active: { type: Boolean, default: true } }));
const Order = mongoose.model('Order', new S({ number: String, user: { type: ID, ref: 'User' }, items: [{ product: ID, name: String, unit: String, price: Number, disc: Number, batch: String, expiry: Date, qty: Number }], subtotal: Number, discount: Number, vat: Number, total: Number, payType: { type: String, default: 'cash' }, dueDate: Date, deliveryMan: String, buyer: { name: String, phone: String, address: String, drugLicense: String, tradeLicense: String }, status: { type: String, default: 'placed' } }, { timestamps: true }));

const Payment = mongoose.model('Payment', new S({ user: { type: ID, ref: 'User' }, amount: Number, method: String, note: String }, { timestamps: true }));
async function ledgerAll(ids) {
  const f = ids ? { user: { $in: ids } } : {};
  const [os, ps] = await Promise.all([Order.find({ ...f, status: { $ne: 'cancelled' } }).sort('createdAt'), Payment.find(f)]);
  const paid = {}, ord = {}, out = {};
  ps.forEach(p => paid[p.user] = (paid[p.user] || 0) + p.amount);
  os.forEach(o => (ord[o.user] = ord[o.user] || []).push(o));
  for (const id of new Set([...Object.keys(ord), ...Object.keys(paid)])) {
    let pool = paid[id] || 0, bal = 0, oldest = null;
    for (const o of ord[id] || []) { bal += o.total; const c = Math.min(pool, o.total); pool -= c; if (c < o.total && o.dueDate && (!oldest || o.dueDate < oldest)) oldest = o.dueDate; }
    out[id] = { balance: bal - (paid[id] || 0), oldest };
  }
  return out;
}

const app = express();
app.use(express.json({ limit: '100kb' }));
app.use(express.static('public'));
const h = f => (q, s) => f(q, s).catch(e => { console.error(e); s.status(500).json({ error: 'সার্ভারে সমস্যা হয়েছে' }); });
const fail = (s, c, m) => s.status(c).json({ error: m });
const auth = role => async (q, s, n) => {
  try {
    const { id } = jwt.verify((q.headers.authorization || '').slice(7), JWT_SECRET);
    const u = await User.findById(id);
    if (!u || u.status !== 'active') return fail(s, 401, 'আবার লগইন করুন');
    if (role && u.role !== role) return fail(s, 403, 'অনুমতি নেই');
    q.user = u; n();
  } catch { fail(s, 401, 'আবার লগইন করুন'); }
};

app.post('/api/register', h(async (q, s) => {
  const { pharmacyName, ownerName, phone, address, drugLicense, tradeLicense, email, password } = q.body;
  if (!pharmacyName || !phone || !drugLicense || !tradeLicense || !/^\S+@\S+\.\S+$/.test(email || '') || (password || '').length < 6) return fail(s, 400, 'ফার্মেসির নাম, ফোন, ড্রাগ ও ট্রেড লাইসেন্স নম্বর, সঠিক ইমেইল ও ৬+ অক্ষরের পাসওয়ার্ড দিন');
  if (await User.findOne({ email: email.toLowerCase().trim() })) return fail(s, 400, 'এই ইমেইল দিয়ে আগেই একাউন্ট আছে');
  await User.create({ pharmacyName, ownerName, phone, address, drugLicense, tradeLicense, email, password: await bcrypt.hash(password, 10) });
  s.json({ ok: true });
}));
const tries = {};
app.post('/api/login', h(async (q, s) => {
  const email = String(q.body.email || '').toLowerCase().trim(), k = q.ip + email;
  if ((tries[k] || 0) >= 8) return fail(s, 429, 'অনেকবার ভুল হয়েছে, ১৫ মিনিট পর চেষ্টা করুন');
  const u = await User.findOne({ email });
  if (!u || !(await bcrypt.compare(String(q.body.password || ''), u.password))) { tries[k] = (tries[k] || 0) + 1; setTimeout(() => delete tries[k], 9e5); return fail(s, 401, 'ইমেইল বা পাসওয়ার্ড ভুল'); }
  if (u.status === 'pending') return fail(s, 403, 'আপনার একাউন্ট এখনো অনুমোদিত হয়নি');
  if (u.status === 'blocked') return fail(s, 403, 'আপনার একাউন্ট বন্ধ আছে');
  s.json({ token: jwt.sign({ id: u._id }, JWT_SECRET, { expiresIn: '30d' }), user: { pharmacyName: u.pharmacyName, role: u.role } });
}));

app.get('/api/products', auth(), h(async (q, s) => s.json(await Product.find({ active: true }).sort('name'))));
app.get('/api/orders/mine', auth(), h(async (q, s) => s.json(await Order.find({ user: q.user._id }).sort('-createdAt'))));
app.post('/api/orders', auth('pharmacy'), h(async (q, s) => {
  const want = (q.body.items || []).filter(i => i.qty > 0);
  if (!want.length) return fail(s, 400, 'কার্ট খালি');
  const ps = await Product.find({ _id: { $in: want.map(w => w.id) } });
  for (const w of want) { const p = ps.find(x => String(x._id) === String(w.id)); if (p && w.qty < (p.moq || 1)) return fail(s, 400, p.name + ': সর্বনিম্ন অর্ডার ' + p.moq); }
  const payType = q.body.payType === 'credit' ? 'credit' : 'cash';
  if (payType === 'credit') {
    const cu = q.user, L = (await ledgerAll([cu._id]))[String(cu._id)] || { balance: 0 };
    const est = want.reduce((a, w) => { const p = ps.find(x => String(x._id) === String(w.id)); return a + (p ? p.price * (1 - (p.discount || 0) / 100) * Math.floor(+w.qty) : 0); }, 0);
    if (!(cu.creditLimit > 0) || L.balance + est * (1 + VAT / 100) > cu.creditLimit) return fail(s, 400, 'বাকির লিমিট শেষ। ক্যাশ অর্ডার করুন বা অ্যাডমিনের সাথে কথা বলুন');
  }
  const done = [], items = [];
  for (const w of want) {
    const qty = Math.floor(+w.qty), pp = ps.find(x => String(x._id) === String(w.id)) || {}, free = pp.bonusBuy > 0 ? Math.floor(qty / pp.bonusBuy) * (pp.bonusFree || 0) : 0, need = qty + free;
    const p = await Product.findOneAndUpdate({ _id: w.id, active: true, stock: { $gte: need } }, { $inc: { stock: -need } });
    if (!p) { for (const d of done) await Product.updateOne({ _id: d.product }, { $inc: { stock: d.qty } }); return fail(s, 400, 'কোনো পণ্যের স্টক শেষ বা কম আছে, পাতা রিফ্রেশ করুন'); }
    done.push({ product: p._id, qty: need }); items.push({ product: p._id, name: p.name, unit: p.unit, price: p.price, disc: p.discount || 0, batch: p.batch, expiry: p.expiry, qty }); if (free) items.push({ product: p._id, name: p.name + ' (ফ্রি বোনাস)', unit: p.unit, price: 0, disc: 0, batch: p.batch, expiry: p.expiry, qty: free });
  }
  const gross = items.reduce((a, i) => a + i.price * i.qty, 0), disc = Math.round(items.reduce((a, i) => a + i.price * i.qty * (i.disc || 0) / 100, 0) * 100) / 100, sub = gross - disc, vat = Math.round(sub * VAT) / 100, u = q.user;
  const o = await Order.create({ number: 'OG-' + Date.now().toString().slice(-8), user: u._id, items, subtotal: gross, discount: disc, vat, total: sub + vat, payType, dueDate: payType === 'credit' ? new Date(Date.now() + (u.creditDays || 30) * 864e5) : undefined, buyer: { name: u.pharmacyName, phone: u.phone, address: u.address, drugLicense: u.drugLicense, tradeLicense: u.tradeLicense } });
  s.json(o);
}));

const Notify = mongoose.model('Notify', new S({ user: ID, product: ID }));
app.get('/api/notify', auth('pharmacy'), h(async (q, s) => s.json((await Notify.find({ user: q.user._id })).map(n => String(n.product)))));
app.post('/api/notify', auth('pharmacy'), h(async (q, s) => { await Notify.updateOne({ user: q.user._id, product: q.body.productId }, { $set: { user: q.user._id, product: q.body.productId } }, { upsert: true }); s.json({ ok: true }); }));
app.delete('/api/notify/:id', auth('pharmacy'), h(async (q, s) => { await Notify.deleteOne({ user: q.user._id, product: q.params.id }); s.json({ ok: true }); }));

const adm = auth('admin');
app.get('/api/admin/customers', adm, h(async (q, s) => {
  const us = await User.find({ role: 'pharmacy' }).select('-password').sort('-createdAt').lean(), L = await ledgerAll();
  s.json(us.map(u => ({ ...u, balance: (L[String(u._id)] || {}).balance || 0, oldest: (L[String(u._id)] || {}).oldest })));
}));
app.get('/api/ledger', auth('pharmacy'), h(async (q, s) => {
  const u = q.user, L = (await ledgerAll([u._id]))[String(u._id)] || { balance: 0 };
  s.json({ creditLimit: u.creditLimit, creditDays: u.creditDays, balance: L.balance, oldest: L.oldest, payments: await Payment.find({ user: u._id }).sort('-createdAt').limit(50) });
}));
app.post('/api/admin/payments', adm, h(async (q, s) => {
  const { userId, amount, method, note } = q.body;
  if (!(amount > 0) || !['cash', 'cheque', 'bank', 'bkash'].includes(method)) return fail(s, 400, 'টাকার পরিমাণ ও পেমেন্ট পদ্ধতি দিন');
  await Payment.create({ user: userId, amount, method, note }); s.json({ ok: true });
}));
app.patch('/api/admin/customers/:id', adm, h(async (q, s) => {
  if (q.body.status && !['active', 'blocked', 'pending'].includes(q.body.status)) return fail(s, 400, 'ভুল স্ট্যাটাস');
  await User.updateOne({ _id: q.params.id, role: 'pharmacy' }, Object.fromEntries(['status', 'creditLimit', 'creditDays'].filter(k => q.body[k] !== undefined).map(k => [k, q.body[k]]))); s.json({ ok: true });
}));
app.post('/api/admin/products', adm, h(async (q, s) => {
  const { name, category, price, stock, mrp, generic, manufacturer, group, unit, moq } = q.body;
  if (!name || !(price >= 0) || !(stock >= 0)) return fail(s, 400, 'নাম, দাম ও স্টক দিন');
  s.json(await Product.create({ name, category, price, stock, mrp, generic, manufacturer, group, unit: unit || 'strip', moq: moq || 1, batch: q.body.batch, expiry: q.body.expiry || undefined, coldChain: !!q.body.coldChain, discount: q.body.discount || 0, bonusBuy: q.body.bonusBuy, bonusFree: q.body.bonusFree }));
}));
app.patch('/api/admin/products/:id', adm, h(async (q, s) => {
  const u = {}; for (const k of ['name', 'category', 'price', 'stock', 'mrp', 'generic', 'manufacturer', 'group', 'unit', 'moq', 'batch', 'expiry', 'coldChain', 'discount', 'bonusBuy', 'bonusFree']) if (q.body[k] !== undefined) u[k] = q.body[k];
  await Product.updateOne({ _id: q.params.id }, u); s.json({ ok: true });
}));
app.delete('/api/admin/products/:id', adm, h(async (q, s) => { await Product.updateOne({ _id: q.params.id }, { active: false }); s.json({ ok: true }); }));
app.get('/api/admin/orders', adm, h(async (q, s) => s.json(await Order.find().sort('-createdAt').limit(200).populate('user', 'pharmacyName phone address'))));
app.patch('/api/admin/orders/:id', adm, h(async (q, s) => {
  if (q.body.status && !['placed', 'processing', 'delivered', 'cancelled'].includes(q.body.status)) return fail(s, 400, 'ভুল স্ট্যাটাস');
  const o = await Order.findById(q.params.id);
  if (!o) return fail(s, 404, 'অর্ডার পাওয়া যায়নি');
  if (o.status !== 'cancelled' && q.body.status === 'cancelled') for (const i of o.items) await Product.updateOne({ _id: i.product }, { $inc: { stock: i.qty } });
  if (o.status === 'cancelled' && q.body.status && q.body.status !== 'cancelled') return fail(s, 400, 'বাতিল অর্ডার আবার চালু করা যায় না');
  if (q.body.status) o.status = q.body.status; if (q.body.deliveryMan !== undefined) o.deliveryMan = q.body.deliveryMan; await o.save(); s.json({ ok: true });
}));

mongoose.connect(MONGO_URI).then(async () => {
  if (!(await User.findOne({ email: ADMIN_EMAIL.toLowerCase() }))) await User.create({ pharmacyName: 'ঔষধ ঘর এডমিন', ownerName: 'Admin', email: ADMIN_EMAIL, password: await bcrypt.hash(ADMIN_PASSWORD, 10), role: 'admin', status: 'active' });
  app.listen(PORT, () => console.log('চালু: পোর্ট ' + PORT));
}).catch(e => { console.error('MongoDB কানেক্ট হয়নি:', e.message); process.exit(1); });
