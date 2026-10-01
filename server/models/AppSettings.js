const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    active: { type: Boolean, default: true },
    link: { type: String, default: '' }, // banner ক্লিক করলে এই লিংকে যাবে (ঐচ্ছিক)
    buttonText: { type: String, default: '' }, // বাটনের লেখা, যেমন "এখনই অর্ডার করুন" (ঐচ্ছিক, খালি থাকলে ডিফল্ট লেখা দেখাবে)
  },
  { _id: true }
);

const appSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'main', unique: true },
    shopName: { type: String, default: 'ঔষধ ঘর' },
    heroTitle: { type: String, default: 'ঘরে বসেই আসল ওষুধ অর্ডার করুন' },
    heroSubtitle: {
      type: String,
      default: 'পাইকারি দামে বিশ্বস্ত ব্র্যান্ডের ওষুধ, দ্রুত ডেলিভারি ও ক্যাশ অন ডেলিভারি সুবিধাসহ।',
    },
    hotline: { type: String, default: '' },
    minOrderApprovalRequired: { type: Boolean, default: true },
    minOrderAmount: { type: Number, default: 500 },
    logoUrl: { type: String, default: '' },
    banners: { type: [bannerSchema], default: [] },
    appEnabled: { type: Boolean, default: true },
    appDisabledMessage: { type: String, default: 'অ্যাপটি সাময়িকভাবে বন্ধ আছে। কিছুক্ষণ পর আবার চেষ্টা করুন।' },

    // ---- Landing page content (managed from Admin > ল্যান্ডিং পেজ) ----
    landingTagline: { type: String, default: 'বাংলাদেশের সবচেয়ে বিশ্বস্ত পাইকারি ওষুধ অর্ডারিং প্ল্যাটফর্ম' },
    landingAbout: {
      type: String,
      default: 'ঔষধ ঘর একটি B2B পাইকারি ওষুধ অর্ডারিং প্ল্যাটফর্ম, যেখানে ফার্মেসি মালিকরা ঘরে বসেই বিশ্বস্ত ব্র্যান্ডের ওষুধ পাইকারি দামে অর্ডার করতে পারেন।',
    },
    landingFeatures: {
      type: [
        {
          icon: { type: String, default: '💊' },
          title: { type: String, default: '' },
          desc: { type: String, default: '' },
        },
      ],
      default: [],
    },
    landingWhyChooseUs: { type: [String], default: [] },
    landingContactAddress: { type: String, default: '' },
    landingContactEmail: { type: String, default: '' },
    landingBanners: { type: [bannerSchema], default: [] }, // দেখান /home/landing.html এর হিরো স্লাইডারে (সর্বোচ্চ ৫টি, অ্যাডমিন প্যানেলে নিয়ন্ত্রিত)
  },
  { timestamps: true }
);

module.exports = mongoose.model('AppSettings', appSettingsSchema);
