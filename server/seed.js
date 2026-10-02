require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Admin = require('./models/Admin');
const Company = require('./models/Company');
const Product = require('./models/Product');
const AppSettings = require('./models/AppSettings');

async function seed() {
  await connectDB();

  // 1) First admin account
  const adminPhone = process.env.ADMIN_PHONE || '01700000000';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin12345';
  const adminName = process.env.ADMIN_NAME || 'Admin';

  let admin = await Admin.findOne({ phone: adminPhone });
  if (!admin) {
    admin = await Admin.create({ name: adminName, phone: adminPhone, password: adminPassword });
    console.log(`✅ অ্যাডমিন তৈরি হয়েছে -> ফোন: ${adminPhone} | পাসওয়ার্ড: ${adminPassword}`);
  } else {
    console.log('ℹ️ অ্যাডমিন আগে থেকেই আছে, নতুন করে তৈরি করা হয়নি');
  }

  // 2) App settings
  const settings = await AppSettings.findOne({ key: 'main' });
  if (!settings) {
    await AppSettings.create({ key: 'main' });
    console.log('✅ ডিফল্ট সেটিংস তৈরি হয়েছে');
  }

  // 3) Sample companies + products (only if none exist yet)
  const companyCount = await Company.countDocuments();
  if (companyCount === 0) {
    const companies = await Company.insertMany([
      { name: 'Square Pharmaceuticals' },
      { name: 'Beximco Pharmaceuticals' },
      { name: 'Incepta Pharmaceuticals' },
      { name: 'Renata Limited' },
      { name: 'ACI Limited' },
    ]);
    console.log(`✅ ${companies.length}টি কোম্পানি যোগ হয়েছে`);

    const sample = [
      { name: 'Napa 500mg', company: companies[0]._id, companyName: companies[0].name, category: 'জ্বর/ব্যথা', unit: 'পাতা', mrp: 30, price: 24, stock: 500 },
      { name: 'Seclo 20mg', company: companies[1]._id, companyName: companies[1].name, category: 'গ্যাস্ট্রিক', unit: 'পাতা', mrp: 84, price: 68, stock: 300 },
      { name: 'Fexo 120mg', company: companies[2]._id, companyName: companies[2].name, category: 'এলার্জি', unit: 'পাতা', mrp: 90, price: 72, stock: 250 },
      { name: 'Monas 10mg', company: companies[3]._id, companyName: companies[3].name, category: 'শ্বাসকষ্ট', unit: 'পাতা', mrp: 150, price: 120, stock: 180 },
      { name: 'Ace 500mg', company: companies[4]._id, companyName: companies[4].name, category: 'জ্বর/ব্যথা', unit: 'পাতা', mrp: 20, price: 16, stock: 600 },
    ];
    const products = await Product.insertMany(sample);
    console.log(`✅ ${products.length}টি নমুনা প্রোডাক্ট যোগ হয়েছে`);
  } else {
    console.log('ℹ️ কোম্পানি/প্রোডাক্ট আগে থেকেই আছে, নমুনা ডেটা যোগ করা হয়নি');
  }

  console.log('🎉 সিড সম্পন্ন হয়েছে');
  await mongoose.connection.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error('সিড ব্যর্থ:', err);
  process.exit(1);
});
