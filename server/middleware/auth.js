const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');
const Admin = require('../models/Admin');

function getToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

// Requires a valid customer token. Blocks pending/blocked customers.
async function customerAuth(req, res, next) {
  try {
    const token = getToken(req);
    if (!token) return res.status(401).json({ message: 'লগইন প্রয়োজন' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'customer') return res.status(403).json({ message: 'অনুমতি নেই' });
    const customer = await Customer.findById(decoded.id);
    if (!customer) return res.status(401).json({ message: 'অ্যাকাউন্ট পাওয়া যায়নি' });
    if (customer.status === 'blocked') return res.status(403).json({ message: 'আপনার অ্যাকাউন্ট ব্লক করা হয়েছে' });
    if (customer.status === 'pending') return res.status(403).json({ message: 'অ্যাকাউন্ট এখনো অনুমোদন হয়নি', pending: true });
    req.customer = customer;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'টোকেন সঠিক নয় বা মেয়াদ শেষ' });
  }
}

// Same as above but allows pending customers through (for profile/status pages)
async function customerAuthAny(req, res, next) {
  try {
    const token = getToken(req);
    if (!token) return res.status(401).json({ message: 'লগইন প্রয়োজন' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'customer') return res.status(403).json({ message: 'অনুমতি নেই' });
    const customer = await Customer.findById(decoded.id);
    if (!customer) return res.status(401).json({ message: 'অ্যাকাউন্ট পাওয়া যায়নি' });
    req.customer = customer;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'টোকেন সঠিক নয় বা মেয়াদ শেষ' });
  }
}

async function adminAuth(req, res, next) {
  try {
    const token = getToken(req);
    if (!token) return res.status(401).json({ message: 'লগইন প্রয়োজন' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ message: 'অনুমতি নেই' });
    const admin = await Admin.findById(decoded.id);
    if (!admin) return res.status(401).json({ message: 'অ্যাডমিন পাওয়া যায়নি' });
    req.admin = admin;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'টোকেন সঠিক নয় বা মেয়াদ শেষ' });
  }
}
async function flexibleAuth(req, res, next) {
  try {
    const token = getToken(req);
    if (!token) return res.status(401).json({ message: 'লগইন প্রয়োজন' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role === 'customer') {
      const customer = await Customer.findById(decoded.id);
      if (!customer) return res.status(401).json({ message: 'অ্যাকাউন্ট পাওয়া যায়নি' });
      req.role = 'customer';
      req.customer = customer;
    } else if (decoded.role === 'admin') {
      const admin = await Admin.findById(decoded.id);
      if (!admin) return res.status(401).json({ message: 'অ্যাডমিন পাওয়া যায়নি' });
      req.role = 'admin';
      req.admin = admin;
    } else {
      return res.status(403).json({ message: 'অনুমতি নেই' });
    }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'টোকেন সঠিক নয় বা মেয়াদ শেষ' });
  }
}
module.exports = { customerAuth, customerAuthAny, adminAuth, flexibleAuth };
