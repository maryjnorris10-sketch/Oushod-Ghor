const express = require('express'), mongoose = require('mongoose'), bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken');
const { MONGO_URI, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, PORT = 3000 } = process.env;
if (!MONGO_URI || !JWT_SECRET || !ADMIN_EMAIL || !ADMIN_PASSWORD) { console.error('MONGO_URI, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD সেট করুন'); process.exit(1); }
const S = mongoose.Schema, ID = S.Types.ObjectId;
const User = mongoose.model('User', new S({ pharmacyName: String, ownerName: String, email: { type: String, unique: true, lowercase: true, trim: true }, phone: String, address: String, password: String, role: { type: String, default: 'pharmacy' }, status: { type: String, default: 'pending' } }, { timestamps: true }));
const Product = mongoose.model('Product', new S({ name: String, category: String, price: Number, stock: { type: Number, default: 0 }, active: { type: Boolean, default: true } }));
const Order = mongoose.model('Order', new S({ number: String, user: { type: ID, ref: 'User' }, items: [{ product: ID, name: String, price: Number, qty: Number }], total: Number, status: { type: String, default: 'placed' } }, { timestamps: true }));

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
  const { pharmacyName, ownerName, phone, address, email, password } = q.body;
  if (!pharmacyName || !phone || !/^\S+@\S+\.\S+$/.test(email || '') || (password || '').length < 6) return fail(s, 400, 'ফার্মেসির নাম, ফোন, সঠিক ইমেইল ও ৬+ অক্ষরের পাসওয়ার্ড দিন');
  if (await User.findOne({ email: email.toLowerCase().trim() })) return fail(s, 400, 'এই ইমেইল দিয়ে আগেই একাউন্ট আছে');
  await User.create({ pharmacyName, ownerName, phone, address, email, password: await bcrypt.hash(password, 10) });
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
  const done = [], items = [];
  for (const w of want) {
    const qty = Math.floor(+w.qty);
    const p = await Product.findOneAndUpdate({ _id: w.id, active: true, stock: { $gte: qty } }, { $inc: { stock: -qty } });
    if (!p) { for (const d of done) await Product.updateOne({ _id: d.product }, { $inc: { stock: d.qty } }); return fail(s, 400, 'কোনো পণ্যের স্টক শেষ বা কম আছে, পাতা রিফ্রেশ করুন'); }
    done.push({ product: p._id, qty }); items.push({ product: p._id, name: p.name, price: p.price, qty });
  }
  const o = await Order.create({ number: 'OG-' + Date.now().toString().slice(-8), user: q.user._id, items, total: items.reduce((a, i) => a + i.price * i.qty, 0) });
  s.json(o);
}));

const adm = auth('admin');
app.get('/api/admin/customers', adm, h(async (q, s) => s.json(await User.find({ role: 'pharmacy' }).select('-password').sort('-createdAt'))));
app.patch('/api/admin/customers/:id', adm, h(async (q, s) => {
  if (!['active', 'blocked', 'pending'].includes(q.body.status)) return fail(s, 400, 'ভুল স্ট্যাটাস');
  await User.updateOne({ _id: q.params.id, role: 'pharmacy' }, { status: q.body.status }); s.json({ ok: true });
}));
app.post('/api/admin/products', adm, h(async (q, s) => {
  const { name, category, price, stock } = q.body;
  if (!name || !(price >= 0) || !(stock >= 0)) return fail(s, 400, 'নাম, দাম ও স্টক দিন');
  s.json(await Product.create({ name, category, price, stock }));
}));
app.patch('/api/admin/products/:id', adm, h(async (q, s) => {
  const u = {}; for (const k of ['name', 'category', 'price', 'stock']) if (q.body[k] !== undefined) u[k] = q.body[k];
  await Product.updateOne({ _id: q.params.id }, u); s.json({ ok: true });
}));
app.delete('/api/admin/products/:id', adm, h(async (q, s) => { await Product.updateOne({ _id: q.params.id }, { active: false }); s.json({ ok: true }); }));
app.get('/api/admin/orders', adm, h(async (q, s) => s.json(await Order.find().sort('-createdAt').limit(200).populate('user', 'pharmacyName phone address'))));
app.patch('/api/admin/orders/:id', adm, h(async (q, s) => {
  if (!['placed', 'processing', 'delivered', 'cancelled'].includes(q.body.status)) return fail(s, 400, 'ভুল স্ট্যাটাস');
  const o = await Order.findById(q.params.id);
  if (!o) return fail(s, 404, 'অর্ডার পাওয়া যায়নি');
  if (o.status !== 'cancelled' && q.body.status === 'cancelled') for (const i of o.items) await Product.updateOne({ _id: i.product }, { $inc: { stock: i.qty } });
  if (o.status === 'cancelled' && q.body.status !== 'cancelled') return fail(s, 400, 'বাতিল অর্ডার আবার চালু করা যায় না');
  o.status = q.body.status; await o.save(); s.json({ ok: true });
}));

mongoose.connect(MONGO_URI).then(async () => {
  if (!(await User.findOne({ email: ADMIN_EMAIL.toLowerCase() }))) await User.create({ pharmacyName: 'ঔষধ ঘর এডমিন', ownerName: 'Admin', email: ADMIN_EMAIL, password: await bcrypt.hash(ADMIN_PASSWORD, 10), role: 'admin', status: 'active' });
  app.listen(PORT, () => console.log('চালু: পোর্ট ' + PORT));
}).catch(e => { console.error('MongoDB কানেক্ট হয়নি:', e.message); process.exit(1); });
