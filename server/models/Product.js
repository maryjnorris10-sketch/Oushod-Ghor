const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    companyName: { type: String, default: '' }, // denormalized for fast display
    category: { type: String, default: 'সাধারণ', trim: true },
    unit: { type: String, default: 'পিস' }, // পিস, বক্স, স্ট্রিপ ইত্যাদি
    form: { type: String, default: '' }, // ট্যাবলেট, ক্যাপসুল, সিরাপ, ইনজেকশন ইত্যাদি — কাস্টমারকে নামের পাশে ছোট ব্যাজে দেখানো হয়
    mrp: { type: Number, required: true, min: 0 }, // ভোক্তা মূল্য
    price: { type: Number, required: true, min: 0 }, // পাইকারি মূল্য (customer pays this)
    stock: { type: Number, default: 0, min: 0 },
    image: { type: String, default: '' },
    inStock: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
    description: { type: String, default: '' },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', companyName: 'text', category: 'text' });
productSchema.index({ createdAt: -1 });
productSchema.index({ inStock: 1 });

module.exports = mongoose.model('Product', productSchema);
