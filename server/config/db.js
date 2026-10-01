const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ MONGO_URI দেওয়া নেই। .env ফাইলে MONGO_URI সেট করুন।');
    process.exit(1);
  }
  try {
    await mongoose.connect(uri);
    console.log('✅ MongoDB সংযুক্ত হয়েছে');
  } catch (err) {
    console.error('❌ MongoDB সংযোগ ব্যর্থ:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
