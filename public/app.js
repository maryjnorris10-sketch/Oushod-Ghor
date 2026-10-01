/* ============ ঔষধ ঘর - ফ্রন্টএন্ড অ্যাপ ============ */

const APP = document.getElementById('app');
const BOTTOM_NAV = document.getElementById('bottomNav');

/* ---------- PWA: installable app + service worker ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  document.querySelectorAll('.installAppBtn').forEach((btn) => btn.classList.remove('hidden'));
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  document.querySelectorAll('.installAppBtn').forEach((btn) => btn.classList.add('hidden'));
});
function wireInstallButtons() {
  document.querySelectorAll('.installAppBtn').forEach((btn) => {
    if (deferredInstallPrompt) btn.classList.remove('hidden');
    btn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      document.querySelectorAll('.installAppBtn').forEach((b) => b.classList.add('hidden'));
    });
  });
}

/* ---------- Wishlist (client-side only, no backend needed) ---------- */
const wishlist = JSON.parse(localStorage.getItem('og_wishlist') || '[]');
function isWished(id) { return wishlist.includes(id); }
function toggleWishlist(id) {
  const i = wishlist.indexOf(id);
  if (i >= 0) wishlist.splice(i, 1); else wishlist.push(id);
  localStorage.setItem('og_wishlist', JSON.stringify(wishlist));
}

/* ---------- Delegated product-card clicks (works for every product grid/row on the page) ---------- */
APP.addEventListener('click', (e) => {
  const wishBtn = e.target.closest('.wish-btn');
  if (wishBtn) {
    toggleWishlist(wishBtn.dataset.wish);
    wishBtn.classList.toggle('active');
    wishBtn.textContent = wishBtn.classList.contains('active') ? '♥' : '♡';
    return;
  }
  const card = e.target.closest('.product-card');
  if (!card) return;
  const id = card.dataset.id;
  const product = state.products.find((p) => p._id === id);
  if (!product) return;
  if (e.target.classList.contains('add-btn')) {
    addToCart(id, 1);
    rerenderProductCard(card, id);
    toast(`${product.name} ${t('added_to_cart')}`);
  } else if (e.target.classList.contains('inc')) {
    if ((state.cart[id] || 0) >= product.stock) { toast(t('stock_limit')); return; }
    addToCart(id, 1);
    rerenderProductCard(card, id);
  } else if (e.target.classList.contains('dec')) {
    setCartQty(id, (state.cart[id] || 0) - 1);
    rerenderProductCard(card, id);
  } else if (e.target.classList.contains('buy-now-btn')) {
    location.hash = '#/cart';
  }
});

/* ---------- State ---------- */
let state = {
  token: localStorage.getItem('og_token') || null,
  role: localStorage.getItem('og_role') || null, // 'customer' | 'admin'
  customer: null,
  admin: null,
  cart: JSON.parse(localStorage.getItem('og_cart') || '{}'), // { productId: qty }
  products: [],
  categories: [],
  companies: [],
  settings: {},
  lang: localStorage.getItem('og_lang') || 'bn',
  productView: localStorage.getItem('og_product_view') || 'grid', // 'grid' | 'list'
};

// state.products is a running CACHE of products seen so far this session (not the
// full catalog — at scale we never load everything at once). Any card currently on
// screen is guaranteed to be cached, since it had to be fetched to be rendered.
function cacheProducts(list) {
  if (!Array.isArray(list)) return;
  list.forEach((p) => {
    const idx = state.products.findIndex((x) => x._id === p._id);
    if (idx >= 0) state.products[idx] = p; else state.products.push(p);
  });
}
// Fetches only the ids not already cached (e.g. cart items after a fresh page load) and merges them in.
async function ensureProductsCached(ids) {
  const missing = ids.filter((id) => !state.products.find((p) => p._id === id));
  if (missing.length === 0) return;
  const fetched = await api(`/products?ids=${missing.join(',')}`, { auth: false });
  cacheProducts(fetched);
}

/* ---------- i18n (বাংলা / English toggle) ---------- */
const I18N = {
  bn: {
    nav_home: 'হোম', nav_products: 'সব পণ্য', nav_orders: 'অর্ডার', nav_cart: 'কার্ট', nav_profile: 'প্রোফাইল',
    search_placeholder: 'ওষুধ বা কোম্পানির নাম লিখুন...',
    all: 'সব', see_more: 'সব দেখুন', no_products: '😕 কোনো পণ্য পাওয়া যায়নি',
    popular_companies: '🏢 জনপ্রিয় কোম্পানি', recently_bought: '🕓 সাম্প্রতিক ক্রয়', new_arrivals: '✨ নতুন পণ্য',
    special_offer: '🔥 বিশেষ অফার', flash_sale: '⚡ ফ্ল্যাশ সেল', all_products: '🛍️ সব পণ্য', all_products_page: '📋 সব পণ্য',
    grid_view: 'গ্রিড', list_view: 'লিস্ট',
    add_to_cart: 'কার্টে যোগ করুন', buy_now: 'এখনই কিনুন',
    in_stock: 'স্টকে আছে', out_of_stock: 'স্টক নেই', per_unit: 'প্রতি', savings: 'সাশ্রয়', stock_limit: 'স্টক সীমা শেষ',
    added_to_cart: 'কার্টে যোগ হয়েছে',
    cart_title: '🛒 আপনার কার্ট', cart_empty: '😕 কার্ট খালি', checkout: 'অর্ডার কনফার্ম করুন', total: 'মোট',
    placing_order: 'অর্ডার হচ্ছে...', login_to_order: 'অর্ডার করতে লগইন করুন',
    orders_title: '📦 আমার অর্ডার', no_orders: '😕 কোনো অর্ডার নেই', view_invoice: '🧾 ইনভয়েস দেখুন / প্রিন্ট করুন',
    profile_title: '👤 প্রোফাইল', logout: 'লগআউট', dark_mode: 'ডার্ক মোড', theme: 'থিম', language: 'ভাষা',
    login: 'লগইন', register: 'রেজিস্ট্রেশন করুন', phone: 'ফোন নম্বর', password: 'পাসওয়ার্ড',
    loading: 'লোড হচ্ছে...',
    admin_dashboard: 'ড্যাশবোর্ড', admin_products: 'প্রোডাক্ট', admin_companies: 'কোম্পানি',
    admin_bulkimport: 'বাল্ক ইমপোর্ট', admin_bulkimage: 'বাল্ক ছবি', admin_orders: 'অর্ডার',
    admin_neworder: 'নতুন অর্ডার', admin_customers: 'কাস্টমার', admin_stockout: 'স্টক আউট',
    admin_announcements: 'নোটিশ', admin_landing: 'ল্যান্ডিং পেজ', admin_admins: 'অ্যাডমিন', admin_settings: 'সেটিংস',
    admin_group_catalog: 'CATALOG', admin_group_sales: 'SALES', admin_group_inventory: 'INVENTORY', admin_group_other: 'অন্যান্য',
    admin_brand_name: 'ঔষধ ঘর Admin',
    dash_total_sales: 'মোট বিক্রয়', dash_today_sales: 'আজকের বিক্রয়', dash_total_orders: 'মোট অর্ডার',
    dash_pending_orders: 'পেন্ডিং অর্ডার', dash_complete_orders: 'সম্পন্ন অর্ডার', dash_total_customers: 'মোট কাস্টমার',
    dash_total_products: 'মোট প্রোডাক্ট', dash_stock_out: 'স্টক আউট', dash_sales_7days: 'গত ৭ দিনের বিক্রয়',
    dash_lowstock_note: '"Low Stock" আর "Expiring Soon" এখনো এই ড্যাশবোর্ডে যোগ করিনি — এগুলোর জন্য প্রোডাক্টে নূন্যতম স্টক সীমা আর মেয়াদ উত্তীর্ণের তারিখ ট্র্যাক করার একটা নতুন ফিচার লাগবে। চাইলে সেটাও বানিয়ে দিতে পারি।',
    action_restock: 'স্টকে ফিরিয়ে আনুন', action_stockout: 'স্টক আউট করুন', action_edit: 'এডিট করুন',
    action_copy_link: 'এই প্রোডাক্টের লিংক কপি করুন', action_delete: 'ডিলিট করুন',
    th_image: 'ছবি', th_name: 'নাম', th_company: 'কোম্পানি', th_price: 'মূল্য', th_stock: 'স্টক', th_status: 'স্ট্যাটাস',
    add_new_product: '+ নতুন প্রোডাক্ট', product_search_placeholder: '🔍 প্রোডাক্ট বা কোম্পানির নাম দিয়ে খুঁজুন...',
    load_more: 'আরও দেখান', no_stockout_products: '🎉 কোনো প্রোডাক্ট স্টক আউট নেই',
    stockout_moved_note_pre: 'স্টক আউট হয়ে যাওয়া প্রোডাক্ট এই লিস্ট থেকে সরে', stockout_moved_note_post: 'ট্যাবে চলে যায় —',
    stockout_moved_note_view: 'দেখুন',
    toast_stock_updated: 'স্টক আপডেট হয়েছে', toast_back_in_stock: 'প্রোডাক্টটি আবার স্টকে ফিরে এসেছে',
    toast_moved_to_stockout: 'প্রোডাক্টটি স্টক আউট হয়ে "স্টক আউট" ট্যাবে চলে গেছে',
    toast_marked_stockout: 'প্রোডাক্টটি স্টক আউট করা হয়েছে', toast_marked_restocked: 'প্রোডাক্টটি স্টকে ফিরিয়ে আনা হয়েছে',
    confirm_delete_product: 'এই প্রোডাক্টটি ডিলিট করতে চান?',
    toast_link_copied: 'লিংক কপি হয়েছে! ব্যানারের "বাটন লিংক" বক্সে পেস্ট করুন', prompt_copy_link: 'এই লিংকটি কপি করুন:',
    stockout_products_count: 'টি স্টক আউট প্রোডাক্ট', back_to_all_companies: '← সব কোম্পানি',
    today: 'আজ', yesterday: 'গতকাল',
    status_pending: 'পেন্ডিং', status_confirmed: 'কনফার্ম', status_processing: 'প্রসেসিং',
    status_shipped: 'শিপড', status_delivered: 'ডেলিভার্ড', status_cancelled: 'বাতিল',
    admin_order_badge: '🛎️ অ্যাডমিন অর্ডার', print_invoice: '🧾 ইনভয়েস প্রিন্ট করুন', edit_order_btn: '✏️ অর্ডার এডিট করুন',
    show_cancelled_orders: 'বাতিল করা অর্ডারও দেখান', cancelled_count_suffix: 'টি বাতিল',
    no_orders_found: 'কোনো অর্ডার নেই', orders_count_suffix: 'টি অর্ডার',
    toast_order_status_updated: 'অর্ডার স্ট্যাটাস আপডেট হয়েছে',
    cust_status_pending: 'পেন্ডিং', cust_status_confirmed: 'কনফার্ম হয়েছে', cust_status_processing: 'প্রসেসিং',
    cust_status_shipped: 'পাঠানো হয়েছে', cust_status_delivered: 'ডেলিভার হয়েছে', cust_status_cancelled: 'বাতিল হয়েছে',
    new_company_name: 'নতুন কোম্পানির নাম', company_name_placeholder: 'যেমন: Square Pharmaceuticals',
    company_logo_optional: 'কোম্পানির লোগো (ঐচ্ছিক)', add_btn: 'যোগ করুন', company_search_placeholder: '🔍 কোম্পানির নাম দিয়ে খুঁজুন...',
    th_logo: 'লোগো', no_companies_found: '😕 কোনো কোম্পানি পাওয়া যায়নি', toast_enter_company_name: 'কোম্পানির নাম লিখুন',
    uploading_image: 'ছবি আপলোড হচ্ছে...', confirm_delete_generic: 'ডিলিট করতে চান?', action_delete_generic: 'ডিলিট করুন',
    neworder_title: '🧾 কাস্টমারের হয়ে নতুন অর্ডার', neworder_step1: 'ধাপ ১: কাস্টমার বেছে নিন',
    neworder_step2: 'ধাপ ২: পণ্য খুঁজে কার্টে যোগ করুন', cust_search_placeholder: '🔍 ফার্মেসির নাম বা ফোন নম্বর দিয়ে খুঁজুন...',
    no_approved_customers: 'অনুমোদিত কোনো কাস্টমার নেই', no_customers_found: '😕 কোনো কাস্টমার পাওয়া যায়নি',
    change_btn: 'পাল্টান', add_short: '+ যোগ করুন', stock_short: 'স্টক', prod_search_placeholder: '🔍 পণ্যের নাম দিয়ে খুঁজুন...',
    empty_cart: '🛒 কার্টে কোনো পণ্য নেই', delivery_address: 'ডেলিভারি ঠিকানা', note_optional: 'নোট (ঐচ্ছিক)',
    note_placeholder: 'যেমন: ফোনে অর্ডার নেওয়া হয়েছে', create_order_btn: '✅ অর্ডার তৈরি করুন', creating: 'তৈরি হচ্ছে...',
    toast_order_created: 'অর্ডার তৈরি হয়েছে! অর্ডার নং:',
    bulkimport_title: '📥 এক্সেল থেকে বাল্ক প্রোডাক্ট ইমপোর্ট',
    bulkimport_instructions: '.xlsx বা .csv ফাইল দিন। প্রথম শিটে অন্তত এই কলামগুলো থাকতে হবে — নাম, কোম্পানি, MRP।\n      ঐচ্ছিক: ক্যাটাগরি, ইউনিট, ধরণ, ছাড় (%), স্টক। ছাড়% থেকে পাইকারি মূল্য (Rate) স্বয়ংক্রিয়ভাবে হিসাব হবে।\n      যেসব প্রোডাক্টের নাম আগে থেকেই আছে সেগুলো এড়িয়ে যাওয়া হবে — একই ফাইল দুইবার আপলোড করলে ডুপ্লিকেট হবে না।',
    toast_file_read_error: 'ফাইল পড়া যায়নি: ', no_valid_products_found: '😕 ফাইল থেকে কোনো বৈধ প্রোডাক্ট (নাম + MRP) পাওয়া যায়নি',
    products_found_sample: '{n} টি প্রোডাক্ট পাওয়া গেছে। নমুনা (প্রথম ৮টি):',
    th_mrp: 'MRP', th_discount: 'ছাড়%', th_rate_calc: 'Rate (হিসাবকৃত)',
    import_n_products: '✅ {n}টি প্রোডাক্ট ইমপোর্ট করুন', importing: 'ইমপোর্ট হচ্ছে...',
    products_added_success: '✅ {n}টি প্রোডাক্ট যোগ হয়েছে', products_skipped_note: '{n}টি প্রোডাক্ট এড়িয়ে যাওয়া হয়েছে (নাম আগে থেকেই ছিল)।',
    go_to_products_list: 'প্রোডাক্ট লিস্টে যান',
    bulkimage_title: '🖼️ প্রোডাক্টের ছবি বাল্ক আপলোড',
    bulkimage_instructions: 'একসাথে অনেক ছবি সিলেক্ট করুন — ফাইলের নাম যা-ই হোক না কেন সমস্যা নেই।\n      প্রতিটা ছবির থাম্বনেইল দেখে, পাশের বক্সে প্রোডাক্টের নাম টাইপ করে লিস্ট থেকে বেছে নিন।',
    type_product_name: 'প্রোডাক্টের নাম লিখুন...', discard_btn: 'বাদ দিন',
    bulkimage_total_line: 'মোট {a}টা ছবি — {b}টা প্রোডাক্টে বসানোর জন্য প্রস্তুত',
    upload_n_images: '✅ {n}টা ছবি আপলোড করুন', uploading_n_of: 'আপলোড হচ্ছে... {a}/{b}',
    images_placed_success: '✅ {n}টা প্রোডাক্টে ছবি বসানো হয়েছে', images_failed_note: '{n}টা আপলোড ব্যর্থ হয়েছে, আবার চেষ্টা করে দেখুন।',
    no_products_found_or_imaged: 'কোনো প্রোডাক্ট পাওয়া যায়নি (অথবা যা পাওয়া গেছে সবগুলোতে আগেই ছবি বসানো হয়ে গেছে)',
    bulkimage_change_link: 'বদলান',
    label_title: 'শিরোনাম', label_message: 'বার্তা', status_active: 'সক্রিয়', status_inactive: 'নিষ্ক্রিয়',
    action_delete_with_icon: '🗑️ ডিলিট',
    add_new_admin_title: '+ নতুন অ্যাডমিন যোগ করুন', label_name: 'নাম', name_placeholder: 'যেমন: রহিম উদ্দিন',
    phone_placeholder: '01XXXXXXXXX', add_admin_btn: 'অ্যাডমিন যোগ করুন', all_admins_count: 'সব অ্যাডমিন',
    th_joined: 'যোগ হয়েছে', you_label: '(আপনি)', toast_fill_all_fields: 'সব তথ্য দিন', adding: 'যোগ করা হচ্ছে...',
    toast_admin_added: '✅ নতুন অ্যাডমিন যোগ হয়েছে', confirm_delete_admin: 'এই অ্যাডমিন অ্যাকাউন্টটি ডিলিট করতে চান?',
    toast_admin_deleted: 'অ্যাডমিন ডিলিট হয়েছে',
    landing_note: 'এখানে যা লিখবেন তা সরাসরি আপনার পাবলিক ল্যান্ডিং পেজে (<b>/home/landing.html</b>) দেখাবে।',
    label_tagline: 'ট্যাগলাইন', label_about_us: 'আমাদের সম্পর্কে', label_contact_address: 'যোগাযোগের ঠিকানা',
    label_contact_email: 'যোগাযোগের ইমেইল', save_btn: 'সংরক্ষণ করুন',
    landing_banners_title: '🖼️ ল্যান্ডিং পেজ স্লাইডার ব্যানার (সর্বোচ্চ {n}টি)',
    label_button_link_optional: 'বাটন লিংক (ঐচ্ছিক — ব্যানারে ক্লিক করলে এখানে যাবে)', link_placeholder: 'https://... অথবা #/products',
    label_button_text_optional: 'বাটনের লেখা (ঐচ্ছিক)', button_text_placeholder: 'যেমন: এখনই অর্ডার করুন',
    save_link_btn: 'লিংক সেভ করুন', banners_max_reached: 'সর্বোচ্চ {n}টি ব্যানার যোগ করা হয়ে গেছে। নতুন একটি যোগ করতে চাইলে আগে একটি ডিলিট করুন।',
    add_new_slider_banner: 'নতুন স্লাইডার ব্যানার যোগ করুন ({a}/{b})', label_button_link: 'বাটন লিংক (ঐচ্ছিক)',
    upload_banner_btn: 'ব্যানার আপলোড করুন', features_title: '✨ ফিচারসমূহ',
    label_icon_emoji: 'আইকন (ইমোজি)', label_title_generic: 'শিরোনাম', title_placeholder_delivery: 'দ্রুত ডেলিভারি',
    label_description: 'বিবরণ', desc_placeholder_delivery: '২৪-৪৮ ঘণ্টার মধ্যে ডেলিভারি', add_feature_btn: '+ ফিচার যোগ করুন',
    why_choose_us_title: '✅ কেন আমাদের বেছে নেবেন', label_one_point: 'একটি পয়েন্ট লিখুন',
    why_point_placeholder: 'যেমন: ১০০% আসল ও লাইসেন্সপ্রাপ্ত ওষুধ', add_point_btn: '+ পয়েন্ট যোগ করুন',
    toast_landing_saved: 'ল্যান্ডিং পেজের তথ্য সংরক্ষণ হয়েছে', toast_select_image: 'ছবি সিলেক্ট করুন', uploading_ellipsis: 'আপলোড হচ্ছে...',
    toast_banner_added: 'ব্যানার যোগ হয়েছে', toast_link_saved: 'লিংক সংরক্ষণ হয়েছে', confirm_delete_banner: 'এই ব্যানারটি ডিলিট করতে চান?',
    toast_enter_feature_title: 'ফিচারের শিরোনাম লিখুন',
    cust_status_label_pending: 'পেন্ডিং', cust_status_label_approved: 'অনুমোদিত', cust_status_label_blocked: 'ব্লকড',
    th_pharmacy: 'ফার্মেসি', th_owner: 'মালিক', th_phone: 'ফোন',
    action_edit_short: '✏️ এডিট', action_approve: 'অনুমোদন', action_block: 'ব্লক', action_unblock: 'আনব্লক',
    action_delete_customer: 'কাস্টমার ডিলিট করুন',
    confirm_delete_customer: 'এই কাস্টমারকে সম্পূর্ণভাবে ডিলিট করতে চান? এটা আর ফিরিয়ে আনা যাবে না।',
    toast_customer_deleted: 'কাস্টমার ডিলিট হয়েছে',
    edit_customer_title: 'কাস্টমার সম্পাদনা', label_pharmacy_name: 'ফার্মেসির নাম', label_owner_name: 'মালিকের নাম',
    label_phone_number: 'ফোন নম্বর', label_address: 'ঠিকানা', label_area: 'এলাকা', label_trade_license: 'ট্রেড লাইসেন্স নং',
    label_status: 'স্ট্যাটাস', label_new_password_optional: 'নতুন পাসওয়ার্ড (ঐচ্ছিক — খালি রাখলে বদলাবে না)',
    placeholder_new_password: 'শুধু পরিবর্তন করতে চাইলে লিখুন', save: 'সংরক্ষণ করুন', cancel: 'বাতিল',
    saving: 'সংরক্ষণ হচ্ছে...', toast_customer_updated: '✅ কাস্টমারের তথ্য আপডেট হয়েছে',
  },
  en: {
    nav_home: 'Home', nav_products: 'All Products', nav_orders: 'Orders', nav_cart: 'Cart', nav_profile: 'Profile',
    search_placeholder: 'Search medicine or company name...',
    all: 'All', see_more: 'See all', no_products: '😕 No products found',
    popular_companies: '🏢 Popular Companies', recently_bought: '🕓 Recently Purchased', new_arrivals: '✨ New Arrivals',
    special_offer: '🔥 Special Offer', flash_sale: '⚡ Flash Sale', all_products: '🛍️ All Products', all_products_page: '📋 All Products',
    grid_view: 'Grid', list_view: 'List',
    add_to_cart: 'Add to Cart', buy_now: 'Buy Now',
    in_stock: 'In Stock', out_of_stock: 'Out of Stock', per_unit: 'Per', savings: 'saved', stock_limit: 'Stock limit reached',
    added_to_cart: 'added to cart',
    cart_title: '🛒 Your Cart', cart_empty: '😕 Cart is empty', checkout: 'Confirm Order', total: 'Total',
    placing_order: 'Placing order...', login_to_order: 'Please login to place an order',
    orders_title: '📦 My Orders', no_orders: '😕 No orders yet', view_invoice: '🧾 View / Print Invoice',
    profile_title: '👤 Profile', logout: 'Logout', dark_mode: 'Dark Mode', theme: 'Theme', language: 'Language',
    login: 'Login', register: 'Register', phone: 'Phone Number', password: 'Password',
    loading: 'Loading...',
    admin_dashboard: 'Dashboard', admin_products: 'Products', admin_companies: 'Companies',
    admin_bulkimport: 'Bulk Import', admin_bulkimage: 'Bulk Images', admin_orders: 'Orders',
    admin_neworder: 'New Order', admin_customers: 'Customers', admin_stockout: 'Stock Out',
    admin_announcements: 'Notices', admin_landing: 'Landing Page', admin_admins: 'Admins', admin_settings: 'Settings',
    admin_group_catalog: 'CATALOG', admin_group_sales: 'SALES', admin_group_inventory: 'INVENTORY', admin_group_other: 'OTHER',
    admin_brand_name: 'Oushod Ghor Admin',
    dash_total_sales: 'Total Sales', dash_today_sales: "Today's Sales", dash_total_orders: 'Total Orders',
    dash_pending_orders: 'Pending Orders', dash_complete_orders: 'Complete Orders', dash_total_customers: 'Total Customers',
    dash_total_products: 'Total Products', dash_stock_out: 'Stock Out', dash_sales_7days: 'Sales — Last 7 Days',
    dash_lowstock_note: '"Low Stock" and "Expiring Soon" are not on this dashboard yet — those need a new feature to track minimum stock thresholds and expiry dates per product. Let me know if you want that built too.',
    action_restock: 'Restock', action_stockout: 'Mark out of stock', action_edit: 'Edit',
    action_copy_link: 'Copy this product\'s link', action_delete: 'Delete',
    th_image: 'Image', th_name: 'Name', th_company: 'Company', th_price: 'Price', th_stock: 'Stock', th_status: 'Status',
    add_new_product: '+ New Product', product_search_placeholder: '🔍 Search by product or company name...',
    load_more: 'Load more', no_stockout_products: '🎉 No products are out of stock',
    stockout_moved_note_pre: 'Out-of-stock products move from this list to the', stockout_moved_note_post: 'tab —',
    stockout_moved_note_view: 'view them',
    toast_stock_updated: 'Stock updated', toast_back_in_stock: 'Product is back in stock',
    toast_moved_to_stockout: 'Product went out of stock and moved to the Stock Out tab',
    toast_marked_stockout: 'Product marked as out of stock', toast_marked_restocked: 'Product restocked',
    confirm_delete_product: 'Delete this product?',
    toast_link_copied: 'Link copied! Paste it into the banner\'s "Button link" box', prompt_copy_link: 'Copy this link:',
    stockout_products_count: 'out-of-stock products', back_to_all_companies: '← All Companies',
    today: 'Today', yesterday: 'Yesterday',
    status_pending: 'Pending', status_confirmed: 'Confirmed', status_processing: 'Processing',
    status_shipped: 'Shipped', status_delivered: 'Delivered', status_cancelled: 'Cancelled',
    admin_order_badge: '🛎️ Admin order', print_invoice: '🧾 Print Invoice', edit_order_btn: '✏️ Edit Order',
    show_cancelled_orders: 'Show cancelled orders too', cancelled_count_suffix: ' cancelled',
    no_orders_found: 'No orders', orders_count_suffix: ' orders',
    toast_order_status_updated: 'Order status updated',
    cust_status_pending: 'Pending', cust_status_confirmed: 'Confirmed', cust_status_processing: 'Processing',
    cust_status_shipped: 'Shipped', cust_status_delivered: 'Delivered', cust_status_cancelled: 'Cancelled',
    new_company_name: 'New Company Name', company_name_placeholder: 'e.g. Square Pharmaceuticals',
    company_logo_optional: 'Company Logo (optional)', add_btn: 'Add', company_search_placeholder: '🔍 Search by company name...',
    th_logo: 'Logo', no_companies_found: '😕 No companies found', toast_enter_company_name: 'Enter a company name',
    uploading_image: 'Uploading image...', confirm_delete_generic: 'Delete this?', action_delete_generic: 'Delete',
    neworder_title: '🧾 New order for a customer', neworder_step1: 'Step 1: Choose a customer',
    neworder_step2: 'Step 2: Find products and add to cart', cust_search_placeholder: '🔍 Search by pharmacy name or phone...',
    no_approved_customers: 'No approved customers', no_customers_found: '😕 No customers found',
    change_btn: 'Change', add_short: '+ Add', stock_short: 'Stock', prod_search_placeholder: '🔍 Search product name...',
    empty_cart: '🛒 Cart is empty', delivery_address: 'Delivery Address', note_optional: 'Note (optional)',
    note_placeholder: 'e.g. order taken over phone', create_order_btn: '✅ Create Order', creating: 'Creating...',
    toast_order_created: 'Order created! Order no:',
    bulkimport_title: '📥 Bulk Import Products from Excel',
    bulkimport_instructions: 'Upload an .xlsx or .csv file. The first sheet must have at least these columns — Name, Company, MRP.\n      Optional: Category, Unit, Form, Discount (%), Stock. Wholesale price (Rate) is auto-calculated from the discount%.\n      Products whose name already exists will be skipped — uploading the same file twice will not create duplicates.',
    toast_file_read_error: 'Could not read file: ', no_valid_products_found: '😕 No valid products (name + MRP) found in the file',
    products_found_sample: '{n} products found. Sample (first 8):',
    th_mrp: 'MRP', th_discount: 'Discount%', th_rate_calc: 'Rate (calculated)',
    import_n_products: '✅ Import {n} products', importing: 'Importing...',
    products_added_success: '✅ {n} products added', products_skipped_note: '{n} products skipped (name already existed).',
    go_to_products_list: 'Go to Products List',
    bulkimage_title: '🖼️ Bulk Upload Product Images',
    bulkimage_instructions: 'Select many images at once — the filename doesn\'t matter.\n      Look at each thumbnail, type the product name in the box next to it, and pick it from the list.',
    type_product_name: 'Type product name...', discard_btn: 'Discard',
    bulkimage_total_line: '{a} images total — {b} ready to assign to products',
    upload_n_images: '✅ Upload {n} images', uploading_n_of: 'Uploading... {a}/{b}',
    images_placed_success: '✅ Images added to {n} products', images_failed_note: '{n} uploads failed, please try again.',
    no_products_found_or_imaged: 'No products found (or everything found already has an image)',
    bulkimage_change_link: 'Change',
    label_title: 'Title', label_message: 'Message', status_active: 'Active', status_inactive: 'Inactive',
    action_delete_with_icon: '🗑️ Delete',
    add_new_admin_title: '+ Add New Admin', label_name: 'Name', name_placeholder: 'e.g. John Doe',
    phone_placeholder: '01XXXXXXXXX', add_admin_btn: 'Add Admin', all_admins_count: 'All Admins',
    th_joined: 'Joined', you_label: '(You)', toast_fill_all_fields: 'Please fill in all fields', adding: 'Adding...',
    toast_admin_added: '✅ New admin added', confirm_delete_admin: 'Delete this admin account?',
    toast_admin_deleted: 'Admin deleted',
    landing_note: 'What you write here shows directly on your public landing page (<b>/home/landing.html</b>).',
    label_tagline: 'Tagline', label_about_us: 'About Us', label_contact_address: 'Contact Address',
    label_contact_email: 'Contact Email', save_btn: 'Save',
    landing_banners_title: '🖼️ Landing Page Slider Banners (max {n})',
    label_button_link_optional: 'Button Link (optional — where the banner goes when clicked)', link_placeholder: 'https://... or #/products',
    label_button_text_optional: 'Button Text (optional)', button_text_placeholder: 'e.g. Order Now',
    save_link_btn: 'Save Link', banners_max_reached: 'You\'ve reached the max of {n} banners. Delete one before adding a new one.',
    add_new_slider_banner: 'Add New Slider Banner ({a}/{b})', label_button_link: 'Button Link (optional)',
    upload_banner_btn: 'Upload Banner', features_title: '✨ Features',
    label_icon_emoji: 'Icon (emoji)', label_title_generic: 'Title', title_placeholder_delivery: 'Fast Delivery',
    label_description: 'Description', desc_placeholder_delivery: 'Delivered within 24-48 hours', add_feature_btn: '+ Add Feature',
    why_choose_us_title: '✅ Why Choose Us', label_one_point: 'Add a point',
    why_point_placeholder: 'e.g. 100% genuine, licensed medicine', add_point_btn: '+ Add Point',
    toast_landing_saved: 'Landing page info saved', toast_select_image: 'Select an image', uploading_ellipsis: 'Uploading...',
    toast_banner_added: 'Banner added', toast_link_saved: 'Link saved', confirm_delete_banner: 'Delete this banner?',
    toast_enter_feature_title: 'Enter a feature title',
    cust_status_label_pending: 'Pending', cust_status_label_approved: 'Approved', cust_status_label_blocked: 'Blocked',
    th_pharmacy: 'Pharmacy', th_owner: 'Owner', th_phone: 'Phone',
    action_edit_short: '✏️ Edit', action_approve: 'Approve', action_block: 'Block', action_unblock: 'Unblock',
    action_delete_customer: 'Delete customer',
    confirm_delete_customer: 'Permanently delete this customer? This cannot be undone.',
    toast_customer_deleted: 'Customer deleted',
    edit_customer_title: 'Edit Customer', label_pharmacy_name: 'Pharmacy Name', label_owner_name: "Owner's Name",
    label_phone_number: 'Phone Number', label_address: 'Address', label_area: 'Area', label_trade_license: 'Trade License No.',
    label_status: 'Status', label_new_password_optional: 'New Password (optional — leave blank to keep unchanged)',
    placeholder_new_password: 'Only fill this in to change it', save: 'Save', cancel: 'Cancel',
    saving: 'Saving...', toast_customer_updated: '✅ Customer info updated',
  },
};
function t(key) {
  return (I18N[state.lang] && I18N[state.lang][key]) || I18N.bn[key] || key;
}
function applyStaticTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  const btnLang = document.getElementById('btnLang');
  if (btnLang) btnLang.textContent = state.lang === 'bn' ? 'EN' : 'বাং';
  document.documentElement.lang = state.lang;
}
function setLang(lang) {
  state.lang = lang;
  localStorage.setItem('og_lang', lang);
  applyStaticTranslations();
  router();
}
document.getElementById('btnLang').addEventListener('click', () => setLang(state.lang === 'bn' ? 'en' : 'bn'));

function wirePasswordToggles(container = document) {
  container.querySelectorAll('.pwd-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.textContent = showing ? '👁️' : '🙈';
    });
  });
}

function saveCart() {
  localStorage.setItem('og_cart', JSON.stringify(state.cart));
  updateCartBadge();
}

/* ---------- Theme (dark/light) ---------- */
function applyTheme(mode) {
  document.documentElement.setAttribute('data-theme', mode);
  localStorage.setItem('og_theme', mode);
}
function initTheme() {
  const saved = localStorage.getItem('og_theme') || 'light';
  applyTheme(saved);
}
initTheme();

function setAuth(token, role) {
  state.token = token;
  state.role = role;
  localStorage.setItem('og_token', token || '');
  localStorage.setItem('og_role', role || '');
  if (!token) localStorage.removeItem('og_token');
}

function logout() {
  setAuth(null, null);
  state.customer = null;
  state.admin = null;
  location.hash = '#/login';
}

/* ---------- API helper ---------- */
async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && state.token) headers['Authorization'] = `Bearer ${state.token}`;
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  let data;
  try { data = await res.json(); } catch (e) { data = {}; }
  if (!res.ok) {
    const err = new Error(data.message || 'সার্ভার সমস্যা হয়েছে');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function uploadImage(file, folder) {
  const form = new FormData();
  form.append('image', file);
  const res = await fetch(`/api/upload?folder=${folder}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${state.token}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'আপলোড ব্যর্থ');
  return data.url;
}

/* ---------- Toast ---------- */
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- Cart helpers ---------- */
function cartCount() {
  return Object.values(state.cart).reduce((a, b) => a + b, 0);
}
function updateCartBadge() {
  const badge = document.getElementById('cartBadge');
  const c = cartCount();
  if (c > 0) { badge.textContent = c; badge.classList.remove('hidden'); }
  else { badge.classList.add('hidden'); }
  updateFloatingBuyBar();
}
/* Floating "এখনই কিনুন" bar — shows above the bottom nav on the shop/products
 * browsing pages whenever the cart has items, so customers can jump straight
 * to checkout without hunting for the cart icon. */
function updateFloatingBuyBar() {
  const bar = document.getElementById('floatingBuyBar');
  if (!bar) return;
  const count = cartCount();
  const path = (location.hash || '#/shop').slice(2).split('/')[0];
  const visibleOn = ['shop', 'products'];
  if (count === 0 || !visibleOn.includes(path) || state.role === 'admin') {
    bar.classList.add('hidden');
    return;
  }
  const total = Object.keys(state.cart).reduce((sum, id) => {
    const p = state.products.find((pp) => pp._id === id);
    return sum + (p ? p.price * state.cart[id] : 0);
  }, 0);
  document.getElementById('fbbCount').textContent = count;
  document.getElementById('fbbTotal').textContent = money(total);
  bar.classList.remove('hidden');
}
function addToCart(productId, qty = 1) {
  state.cart[productId] = (state.cart[productId] || 0) + qty;
  saveCart();
}
function setCartQty(productId, qty) {
  if (qty <= 0) delete state.cart[productId];
  else state.cart[productId] = qty;
  saveCart();
}

/* ---------- Router ---------- */
const routes = {};
function route(path, handler) { routes[path] = handler; }
const CUSTOMER_SIDE_VIEWS = ['shop', 'products', 'product', 'cart', 'orders', 'notifications', 'profile'];
/* Keeps the topbar অ্যাডমিন/ইউজার toggle in sync with wherever the admin
 * currently is, so it always reflects reality no matter how they navigated. */
function updateAdminViewSwitch(path) {
  const el = document.getElementById('adminViewSwitch');
  if (!el) return;
  if (state.role !== 'admin') { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  const mode = CUSTOMER_SIDE_VIEWS.includes(path) ? 'user' : 'admin';
  [...el.querySelectorAll('button')].forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
}
document.getElementById('adminViewSwitch').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-mode]');
  if (!btn) return;
  location.hash = btn.dataset.mode === 'admin' ? '#/admin' : '#/shop';
});
async function router() {
  const hash = location.hash || '#/shop';
  const [path, ...rest] = hash.slice(2).split('/');
  const key = '/' + path;
  updateBottomNav(path);
  updateAdminViewSwitch(path);
  if (path !== 'admin') APP.classList.remove('admin-active');
  const handler = routes[key] || routes['/shop'];
  APP.innerHTML = `<div class="empty-state">${t('loading')}</div>`;
  try {
    await handler(rest);
    updateFloatingBuyBar();
  } catch (err) {
    APP.innerHTML = `<div class="empty-state">⚠️ ${escapeHtml(err.message)}</div>`;
  }
}
window.addEventListener('hashchange', router);

function updateBottomNav(path) {
  const custViews = ['shop', 'products', 'orders', 'cart', 'profile'];
  if (custViews.includes(path)) {
    BOTTOM_NAV.classList.remove('hidden');
    [...BOTTOM_NAV.querySelectorAll('a')].forEach((a) => {
      a.classList.toggle('active', a.dataset.view === path);
    });
  } else {
    BOTTOM_NAV.classList.add('hidden');
  }
  updateFloatingBuyBar();
}
BOTTOM_NAV.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-view]');
  if (a) location.hash = '#/' + a.dataset.view;
});

document.getElementById('btnCart').addEventListener('click', () => (location.hash = '#/cart'));
document.getElementById('btnNotif').addEventListener('click', () => (location.hash = '#/notifications'));

// Rewrites a Cloudinary URL to request a resized, auto-format/auto-quality
// version instead of the original full-resolution upload. Uploaded product
// photos are often several MB straight off a phone camera — on mobile
// networks that's the single biggest drag on page load. No re-upload needed;
// Cloudinary generates the resized version on first request and caches it.
function cldResize(url, width) {
  if (!url || typeof url !== 'string' || !url.includes('/upload/')) return url;
  return url.replace('/upload/', `/upload/w_${width},q_auto,f_auto,c_limit/`);
}
function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (m) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
}
function money(n) { return `৳${Number(n).toLocaleString('bn-BD')}`; }

/* ---------- Group a list of orders (already sorted newest-first) by day,
 * so admin/customer order lists show "আজ / গতকাল / তারিখ" section headers
 * instead of one long flat list. ---------- */
function dayLabel(date) {
  const d = new Date(date);
  const now = new Date();
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (diffDays === 0) return t('today');
  if (diffDays === 1) return t('yesterday');
  return d.toLocaleDateString(state.lang === 'en' ? 'en-US' : 'bn-BD', { day: 'numeric', month: 'long', year: 'numeric' });
}
function groupOrdersByDay(orders) {
  const groups = [];
  for (const o of orders) {
    const label = dayLabel(o.createdAt);
    let group = groups[groups.length - 1];
    if (!group || group.label !== label) {
      group = { label, orders: [] };
      groups.push(group);
    }
    group.orders.push(o);
  }
  return groups;
}

/* ---------- Dosage-form badge (ট্যাবলেট/ক্যাপসুল/সিরাপ ইত্যাদি) ----------
 * Uses the admin-set `form` field when present; otherwise makes a best-guess
 * from common keywords/abbreviations that already appear in most medicine
 * names, so older products (added before this field existed) still get a
 * sensible label without needing to be re-edited one by one. */
const FORM_LABELS = {
  ট্যাবলেট: { icon: '💊', label: 'ট্যাবলেট' },
  ক্যাপসুল: { icon: '💊', label: 'ক্যাপসুল' },
  সিরাপ: { icon: '🍯', label: 'সিরাপ' },
  ইনজেকশন: { icon: '💉', label: 'ইনজেকশন' },
  'ক্রিম/মলম': { icon: '🧴', label: 'ক্রিম/মলম' },
  ড্রপ: { icon: '💧', label: 'ড্রপ' },
  ইনহেলার: { icon: '🌬️', label: 'ইনহেলার' },
  সাপোজিটরি: { icon: '🔹', label: 'সাপোজিটরি' },
};
const FORM_AUTO_DETECT_RULES = [
  { re: /\b(tab|tablet)\b/i, key: 'ট্যাবলেট' },
  { re: /\b(cap|capsule)\b/i, key: 'ক্যাপসুল' },
  { re: /\b(syr|syrup|suspension|susp)\b/i, key: 'সিরাপ' },
  { re: /\b(inj|injection|vial|iv|im)\b/i, key: 'ইনজেকশন' },
  { re: /\b(cream|oint|ointment|gel)\b/i, key: 'ক্রিম/মলম' },
  { re: /\b(drop|drops)\b/i, key: 'ড্রপ' },
  { re: /\b(inhaler|mdi|respule)\b/i, key: 'ইনহেলার' },
  { re: /\b(suppository|supp)\b/i, key: 'সাপোজিটরি' },
];
function formBadge(product) {
  if (!product.category) return '';
  return `<span class="form-badge">${escapeHtml(product.category)}</span>`;
}
// Same detection, but returns just the plain label text (used on the printed
// invoice, which stays black-and-white/no colored badges). Prefers the
// admin-set `form` field; falls back to scanning the name for common
// tablet/capsule/syrup-style keywords so older orders still show something.
function detectFormLabel(item) {
  if (item.form && FORM_LABELS[item.form]) return FORM_LABELS[item.form].label;
  const hay = `${item.name || ''} ${item.category || ''}`;
  for (const rule of FORM_AUTO_DETECT_RULES) {
    if (rule.re.test(hay)) return FORM_LABELS[rule.key].label;
  }
  return '';
}

/* ================= AUTH GUARDS ================= */
function requireCustomer() {
  if (state.role !== 'customer' || !state.token) {
    location.hash = '#/login';
    throw new Error('লগইন প্রয়োজন');
  }
}
function requireAdmin() {
  if (state.role !== 'admin' || !state.token) {
    location.hash = '#/admin-login';
    throw new Error('অ্যাডমিন লগইন প্রয়োজন');
  }
}

/* ================= SHOP (HOME) ================= */
route('/shop', async () => {
  const [settings, announcements, categories, newestBatch, deals, companies] = await Promise.all([
    api('/settings', { auth: false }),
    api('/announcements', { auth: false }),
    api('/products/categories', { auth: false }),
    api('/products?limit=24', { auth: false }),
    api('/products/deals?limit=16', { auth: false }),
    api('/companies', { auth: false }),
  ]);
  state.settings = settings;
  state.companies = companies;
  state.categories = categories;

  // Only fetch order history for a logged-in customer (used for "recently purchased")
  let recentlyPurchased = [];
  if (state.role === 'customer' && state.token) {
    try {
      const recentOrders = await api('/orders/mine');
      const ids = [];
      const seen = new Set();
      loop: for (const order of recentOrders) {
        for (const item of order.items) {
          const pid = item.product;
          if (!pid || seen.has(pid)) continue;
          seen.add(pid);
          ids.push(pid);
          if (ids.length >= 8) break loop;
        }
      }
      if (ids.length) {
        const fetched = await api(`/products?ids=${ids.join(',')}`, { auth: false });
        recentlyPurchased = ids.map((id) => fetched.find((p) => p._id === id)).filter(Boolean);
      }
    } catch (e) { /* not fatal on home page */ }
  }

  renderShop(newestBatch.items, deals, announcements, recentlyPurchased);
  cacheProducts(newestBatch.items);
  cacheProducts(deals);
  cacheProducts(recentlyPurchased);
});

function discountOf(p) {
  return p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
}

function renderShop(newestBatch, deals, announcements, recentlyPurchased, activeCategory = '', query = '') {
  const categories = state.categories;
  const newArrivals = newestBatch.slice(0, 8);
  const specialOffer = deals.slice(0, 8);
  const flashSale = deals.slice(8, 16);
  // The bottom "all products" preview starts as the newest batch; once the person
  // searches or picks a category it's replaced with real server-side results —
  // never the full catalog client-side.
  let previewItems = newestBatch;

  // Banners are managed from a single place — the "ল্যান্ডিং পেজ" admin tab —
  // to avoid the confusion of two separate banner lists competing to show.
  const activeBanners = (state.settings.landingBanners || []).filter((b) => b.active);

  APP.innerHTML = `
    ${announcements.length ? `
      <div class="announce-ticker">
        <div class="announce-ticker-track" style="animation-duration:${Math.max(18, announcements.reduce((s, a) => s + a.title.length + a.message.length, 0) * 0.28)}s;">
          <span class="announce-ticker-item">${announcements.map((a) => `📢 ${escapeHtml(a.title)}: ${escapeHtml(a.message)}`).join('&nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp;')}</span>
          <span class="announce-ticker-item" aria-hidden="true">${announcements.map((a) => `📢 ${escapeHtml(a.title)}: ${escapeHtml(a.message)}`).join('&nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp;')}</span>
        </div>
      </div>
    ` : ''}
    ${activeBanners.length ? `
      <div class="banner-carousel" id="bannerCarousel">
        ${activeBanners.map((b) => `
          <${b.link ? 'a' : 'div'} class="banner-slide" ${b.link ? `href="${escapeHtml(b.link)}"` : ''}>
            <img src="${cldResize(b.url, 1000)}" class="banner-img">
            ${b.link ? `<span class="banner-cta">${escapeHtml(b.buttonText || 'এখনই দেখুন →')}</span>` : ''}
          </${b.link ? 'a' : 'div'}>
        `).join('')}
      </div>
      ${activeBanners.length > 1 ? `<div class="banner-dots" id="bannerDots">${activeBanners.map((_, i) => `<span class="dot ${i === 0 ? 'active' : ''}"></span>`).join('')}</div>` : ''}
    ` : ''}
    <div class="card">
      <div style="font-weight:700; font-size:17px; margin-bottom:4px;">${escapeHtml(state.settings.heroTitle || '')}</div>
      <div class="muted" style="font-size:13.5px;">${escapeHtml(state.settings.heroSubtitle || '')}</div>
      ${state.settings.landingTagline ? `<div style="margin-top:8px; font-size:12.5px; color:var(--green-dark); background:var(--green-light); display:inline-block; padding:5px 12px; border-radius:14px;">${escapeHtml(state.settings.landingTagline)}</div>` : ''}
    </div>
    ${(state.settings.landingFeatures || []).length ? `
      <div class="feature-strip">
        ${state.settings.landingFeatures.slice(0, 6).map((f) => `
          <div class="feature-chip">
            <div class="fi">${escapeHtml(f.icon || '💊')}</div>
            <div class="ft">${escapeHtml(f.title || '')}</div>
          </div>
        `).join('')}
      </div>
    ` : ''}
    <div class="search-bar">
      <input type="text" id="searchInput" placeholder="${t('search_placeholder')}" value="${escapeHtml(query)}">
    </div>

    ${state.companies.length ? `
      <div class="section-head"><div class="section-title" style="margin:0;">${t('popular_companies')}</div></div>
      <div class="company-strip">
        <div class="company-strip-track" style="animation-duration:${Math.max(16, state.companies.length * 3.2)}s;">
          ${state.companies.map(companyChip).join('')}
          ${state.companies.map(companyChip).join('')}
        </div>
      </div>
    ` : ''}

    ${recentlyPurchased.length ? productSection(t('recently_bought'), recentlyPurchased) : ''}
    ${newArrivals.length ? productSection(t('new_arrivals'), newArrivals) : ''}
    ${specialOffer.length ? productSection(t('special_offer'), specialOffer) : ''}
    ${flashSale.length ? productSection(t('flash_sale'), flashSale) : ''}

    <div class="section-head"><div class="section-title" style="margin:0;">${t('all_products')}</div><a href="#/products" class="see-more">${t('see_more')}</a></div>
    <div class="category-chips" id="chips">
      <div class="chip ${!activeCategory ? 'active' : ''}" data-cat="">${t('all')}</div>
      ${categories.map((c) => `<div class="chip ${c === activeCategory ? 'active' : ''}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</div>`).join('')}
    </div>
    <div class="product-grid" id="productGrid">
      ${previewItems.length ? previewItems.map((p) => productCard(p)).join('') : `<div class="empty-state" style="grid-column:1/-1;">${t('no_products')}</div>`}
    </div>
  `;

  if (activeBanners.length > 1) {
    const carousel = document.getElementById('bannerCarousel');
    const dots = document.querySelectorAll('#bannerDots .dot');
    let idx = 0;
    setInterval(() => {
      idx = (idx + 1) % activeBanners.length;
      carousel.scrollTo({ left: carousel.clientWidth * idx, behavior: 'smooth' });
      dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    }, 4000);
  }

  let searchDebounce;
  async function updatePreview() {
    const params = new URLSearchParams({ limit: '24' });
    if (query) params.set('q', query);
    if (activeCategory) params.set('category', activeCategory);
    const res = query || activeCategory ? await api(`/products?${params.toString()}`, { auth: false }) : { items: newestBatch };
    previewItems = res.items;
    cacheProducts(previewItems);
    document.getElementById('productGrid').innerHTML = previewItems.length
      ? previewItems.map((p) => productCard(p)).join('')
      : `<div class="empty-state" style="grid-column:1/-1;">${t('no_products')}</div>`;
  }
  document.getElementById('searchInput').addEventListener('input', (e) => {
    query = e.target.value;
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(async () => {
      await updatePreview();
      const input = document.getElementById('searchInput');
      input.focus();
      input.setSelectionRange(query.length, query.length);
    }, 300);
  });
  document.getElementById('chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    activeCategory = chip.dataset.cat;
    [...document.querySelectorAll('#chips .chip')].forEach((c) => c.classList.toggle('active', c.dataset.cat === activeCategory));
    updatePreview();
  });
  const companyStripEl = document.querySelector('.company-strip');
  if (companyStripEl) {
    companyStripEl.addEventListener('click', (e) => {
      const chip = e.target.closest('.company-chip');
      if (chip) {
        pendingCompanyId = chip.dataset.companyId;
        location.hash = '#/products';
      }
    });
  }
}

/* ================= SINGLE PRODUCT DETAIL (linkable page for one product — e.g. from a banner) ================= */
route('/product', async (rest) => {
  const id = rest[0];
  let p;
  try {
    p = await api(`/products/${id}`, { auth: false });
  } catch (e) {
    p = null;
  }
  if (!p) {
    APP.innerHTML = `<div class="empty-state">😕 প্রোডাক্টটি পাওয়া যায়নি</div>`;
    return;
  }
  cacheProducts([p]);
  const discount = discountOf(p);
  const savings = p.mrp > p.price ? p.mrp - p.price : 0;
  const inStockOk = p.inStock && p.stock > 0;

  APP.innerHTML = `
    <a href="#/products" class="muted" style="font-size:13px; display:inline-block; margin-bottom:10px;">← সব পণ্যে ফিরে যান</a>
    <div class="card">
      ${p.image ? `<img src="${cldResize(p.image, 700)}" style="width:100%; border-radius:12px; aspect-ratio:4/3; object-fit:cover; margin-bottom:12px;">` : ''}
      <div class="company">${escapeHtml(p.companyName || '')}</div>
      <div style="font-size:19px; font-weight:700; margin:4px 0;">${escapeHtml(p.name)}${formBadge(p)}</div>
      <div class="price-row" style="margin:8px 0;">
        <span class="price" style="font-size:22px;">${money(p.price)}</span>
        ${p.mrp > p.price ? `<span class="mrp">${money(p.mrp)}</span>` : ''}
        ${discount ? `<span class="discount-ribbon" style="position:static; display:inline-block;">${discount}% ছাড়</span>` : ''}
      </div>
      ${savings ? `<div class="savings-text">${money(savings)} ${t('savings')}</div>` : ''}
      <div class="row-between" style="margin:10px 0;">
        <span class="unit">${t('per_unit')} ${escapeHtml(p.unit)}</span>
        <span class="${inStockOk ? 'in-stock-text' : 'stock-out'}">${inStockOk ? t('in_stock') : t('out_of_stock')}</span>
      </div>
      <div id="productDetailActions" style="margin-top:14px;"></div>
    </div>
  `;

  function renderActions() {
    const qty = state.cart[p._id] || 0;
    const box = document.getElementById('productDetailActions');
    if (!inStockOk) { box.innerHTML = ''; return; }
    box.innerHTML = qty === 0
      ? `<button class="btn btn-primary btn-block" id="pdAddBtn">${t('add_to_cart')}</button>`
      : `<div class="qty-row" style="justify-content:center; margin-bottom:10px;">
           <button id="pdDec">−</button><span class="qty-val">${qty}</span><button id="pdInc">+</button>
         </div>
         <a href="#/cart" class="btn btn-outline btn-block rise-in">${t('buy_now')}</a>`;
    const addBtn = document.getElementById('pdAddBtn');
    if (addBtn) addBtn.addEventListener('click', () => { addToCart(p._id, 1); toast(`${p.name} ${t('added_to_cart')}`); renderActions(); });
    const inc = document.getElementById('pdInc');
    if (inc) inc.addEventListener('click', () => {
      if ((state.cart[p._id] || 0) >= p.stock) { toast(t('stock_limit')); return; }
      addToCart(p._id, 1); renderActions();
    });
    const dec = document.getElementById('pdDec');
    if (dec) dec.addEventListener('click', () => { setCartQty(p._id, (state.cart[p._id] || 0) - 1); renderActions(); });
  }
  renderActions();
});

/* ================= FULL PRODUCT LIST (dedicated page — every product, no curated sections) ================= */
let pendingCompanyId = null;
route('/products', async () => {
  if (state.categories.length === 0) {
    state.categories = await api('/products/categories', { auth: false });
  }
  if (state.companies.length === 0) {
    state.companies = await api('/companies', { auth: false });
  }
  const initialCompanyId = pendingCompanyId || '';
  pendingCompanyId = null;
  await renderProductsList('', '', initialCompanyId);
});

let productsPageState = { items: [], page: 1, hasMore: false, loading: false };

async function renderProductsList(activeCategory = '', query = '', companyId = '') {
  const isList = state.productView === 'list';
  const activeCompany = companyId ? state.companies.find((c) => c._id === companyId) : null;

  async function fetchPage(page) {
    const params = new URLSearchParams({ limit: '60', page: String(page) });
    if (query) params.set('q', query);
    if (activeCategory) params.set('category', activeCategory);
    if (companyId) params.set('company', companyId);
    const res = await api(`/products?${params.toString()}`, { auth: false });
    cacheProducts(res.items);
    return res;
  }

  productsPageState = { items: [], page: 1, hasMore: false, loading: true };
  const first = await fetchPage(1);
  productsPageState = { items: first.items, page: 1, hasMore: first.hasMore, loading: false };

  function gridHtml() {
    return productsPageState.items.length
      ? productsPageState.items.map((p) => productCard(p, false, isList)).join('')
      : `<div class="empty-state" style="grid-column:1/-1;">${t('no_products')}</div>`;
  }

  APP.innerHTML = `
    <div class="section-head">
      <div class="section-title" style="margin:0;">${t('all_products_page')}</div>
      <div class="view-toggle" id="viewToggle">
        <button class="${!isList ? 'active' : ''}" data-view="grid" title="${t('grid_view')}">▦</button>
        <button class="${isList ? 'active' : ''}" data-view="list" title="${t('list_view')}">☰</button>
      </div>
    </div>
    ${activeCompany ? `
      <div class="active-filter-chip">
        🏢 ${escapeHtml(activeCompany.name)} <span id="clearCompanyFilter">✕</span>
      </div>
    ` : ''}
    <div class="search-bar">
      <input type="text" id="searchInput" placeholder="${t('search_placeholder')}" value="${escapeHtml(query)}">
    </div>
    <div class="category-chips" id="chips">
      <div class="chip ${!activeCategory ? 'active' : ''}" data-cat="">${t('all')}</div>
      ${state.categories.map((c) => `<div class="chip ${c === activeCategory ? 'active' : ''}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</div>`).join('')}
    </div>
    <div class="${isList ? 'product-list' : 'product-grid'}" id="productGrid">${gridHtml()}</div>
    <div id="loadMoreArea" style="text-align:center; margin-top:16px;">
      ${productsPageState.hasMore ? `<button class="btn btn-outline" id="loadMoreBtn">আরও দেখান</button>` : ''}
    </div>
  `;

  let searchDebounce;
  document.getElementById('searchInput').addEventListener('input', (e) => {
    const val = e.target.value;
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(async () => {
      await renderProductsList(activeCategory, val, companyId);
      const input = document.getElementById('searchInput');
      if (input) {
        input.focus();
        input.setSelectionRange(val.length, val.length);
      }
    }, 300);
  });
  document.getElementById('chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) renderProductsList(chip.dataset.cat, query, companyId);
  });
  const clearBtn = document.getElementById('clearCompanyFilter');
  if (clearBtn) clearBtn.addEventListener('click', () => renderProductsList(activeCategory, query, ''));
  document.getElementById('viewToggle').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-view]');
    if (!btn) return;
    state.productView = btn.dataset.view;
    localStorage.setItem('og_product_view', state.productView);
    renderProductsList(activeCategory, query, companyId);
  });
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', async () => {
      if (productsPageState.loading) return;
      productsPageState.loading = true;
      loadMoreBtn.textContent = 'লোড হচ্ছে...';
      const next = await fetchPage(productsPageState.page + 1);
      productsPageState.items = productsPageState.items.concat(next.items);
      productsPageState.page += 1;
      productsPageState.hasMore = next.hasMore;
      productsPageState.loading = false;
      document.getElementById('productGrid').innerHTML = gridHtml();
      document.getElementById('loadMoreArea').innerHTML = productsPageState.hasMore ? `<button class="btn btn-outline" id="loadMoreBtn">আরও দেখান</button>` : '';
      const newBtn = document.getElementById('loadMoreBtn');
      if (newBtn) newBtn.addEventListener('click', () => loadMoreBtn.click());
    });
  }
}

function companyChip(c) {
  return `
    <div class="company-chip" data-company-id="${c._id}">
      <div class="logo-circle">${c.logo ? `<img src="${c.logo}">` : `<span style="font-weight:700;color:var(--green-dark);font-size:18px;">${escapeHtml((c.name || '?').slice(0, 1))}</span>`}</div>
      <div class="cname">${escapeHtml(c.name)}</div>
    </div>
  `;
}

function productSection(title, items) {
  return `
    <div class="section-head"><div class="section-title" style="margin:0;">${title}</div></div>
    <div class="hscroll">${items.map((p) => productCard(p, true)).join('')}</div>
  `;
}

function productCard(p, mini = false, listView = false) {
  const qty = state.cart[p._id] || 0;
  const discount = discountOf(p);
  const savings = p.mrp > p.price ? p.mrp - p.price : 0;
  const inStockOk = p.inStock && p.stock > 0;
  const wished = isWished(p._id);
  const cartControls = !inStockOk
    ? ''
    : qty === 0
      ? `<button class="btn btn-primary btn-sm btn-block add-btn">${t('add_to_cart')}</button>`
      : `<div class="qty-row">
           <button class="dec">−</button>
           <span class="qty-val">${qty}</span>
           <button class="inc">+</button>
         </div>
         <button class="btn btn-outline btn-sm btn-block buy-now-btn rise-in">${t('buy_now')}</button>`;

  if (listView) {
    return `
      <div class="product-card product-list-item ${mini ? 'mini' : ''}" data-id="${p._id}">
        ${p.image ? `<img src="${cldResize(p.image, 300)}" class="pimg" loading="lazy">` : `<div class="pimg pimg-placeholder">💊</div>`}
        <div class="pli-info">
          <div class="row-between">
            <div class="company">${escapeHtml(p.companyName || '')}</div>
            <div class="wish-btn ${wished ? 'active' : ''}" data-wish="${p._id}">${wished ? '♥' : '♡'}</div>
          </div>
          <div class="pname">${escapeHtml(p.name)}${formBadge(p)}${discount ? ` <span class="discount-ribbon" style="position:static; display:inline-block;">${discount}% ছাড়</span>` : ''}</div>
          <div class="price-row">
            <span class="price">${money(p.price)}</span>
            ${p.mrp > p.price ? `<span class="mrp">${money(p.mrp)}</span>` : ''}
            ${savings ? `<span class="savings-text">${money(savings)} ${t('savings')}</span>` : ''}
          </div>
          <div class="row-between">
            <span class="unit">${t('per_unit')} ${escapeHtml(p.unit)}</span>
            <span class="${inStockOk ? 'in-stock-text' : 'stock-out'}">${inStockOk ? t('in_stock') : t('out_of_stock')}</span>
          </div>
          <div class="pli-actions">${cartControls}</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="product-card ${mini ? 'mini' : ''}" data-id="${p._id}">
      ${discount ? `<div class="discount-ribbon">${discount}% ছাড়</div>` : ''}
      <div class="wish-btn ${wished ? 'active' : ''}" data-wish="${p._id}">${wished ? '♥' : '♡'}</div>
      ${p.image ? `<img src="${cldResize(p.image, 300)}" class="pimg" loading="lazy">` : `<div class="pimg pimg-placeholder">💊</div>`}
      <div class="company">${escapeHtml(p.companyName || '')}</div>
      <div class="pname">${escapeHtml(p.name)}${formBadge(p)}</div>
      <div class="price-row">
        <span class="price">${money(p.price)}</span>
        ${p.mrp > p.price ? `<span class="mrp">${money(p.mrp)}</span>` : ''}
      </div>
      ${savings ? `<div class="savings-text">${money(savings)} ${t('savings')}</div>` : ''}
      <div class="row-between">
        <span class="unit">${t('per_unit')} ${escapeHtml(p.unit)}</span>
        <span class="${inStockOk ? 'in-stock-text' : 'stock-out'}">${inStockOk ? t('in_stock') : t('out_of_stock')}</span>
      </div>
      ${cartControls}
    </div>
  `;
}
function rerenderProductCard(card, id) {
  const product = state.products.find((p) => p._id === id);
  const mini = card.classList.contains('mini');
  const listView = card.classList.contains('product-list-item');
  const temp = document.createElement('div');
  temp.innerHTML = productCard(product, mini, listView);
  card.replaceWith(temp.firstElementChild);
}

/* ================= CART ================= */
route('/cart', async () => {
  await ensureProductsCached(Object.keys(state.cart));
  if (!state.settings || !state.settings.minOrderAmount) {
    state.settings = await api('/settings', { auth: false });
  }
  renderCart();
});

function renderCart() {
  const ids = Object.keys(state.cart);
  const items = ids
    .map((id) => ({ product: state.products.find((p) => p._id === id), qty: state.cart[id] }))
    .filter((x) => x.product);
  const total = items.reduce((sum, x) => sum + x.product.price * x.qty, 0);
  const minOrderAmount = (state.settings && state.settings.minOrderAmount) || 500;
  const belowMin = items.length > 0 && total < minOrderAmount;

  APP.innerHTML = `
    <div class="section-title">${t('cart_title')}</div>
    ${items.length === 0 ? `
      <div class="empty-state"><div class="icon">🛒</div>${t('cart_empty')}<br><br>
        <a href="#/shop" class="btn btn-primary btn-sm">${t('nav_home')}</a>
      </div>` : `
      <div class="card" id="cartList">
        ${items.map((x) => `
          <div class="cart-item" data-id="${x.product._id}">
            <div>
              <div class="ci-name">${escapeHtml(x.product.name)}</div>
              <div class="ci-sub">${money(x.product.price)} × ${x.qty} = ${money(x.product.price * x.qty)}</div>
            </div>
            <div class="qty-row">
              <button class="dec">−</button>
              <span class="qty-val">${x.qty}</span>
              <button class="inc">+</button>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="card">
        <div class="summary-row total"><span>${t('total')}</span><span>${money(total)}</span></div>
      </div>
      ${belowMin ? `
        <div class="min-order-notice">
          ⚠️ সর্বনিম্ন অর্ডার মূল্য ${money(minOrderAmount)}। আরও ${money(minOrderAmount - total)} টাকার পণ্য যোগ করুন।
        </div>
      ` : ''}
      <div class="card">
        <label>ডেলিভারি ঠিকানা (ঐচ্ছিক - খালি রাখলে প্রোফাইলের ঠিকানা ব্যবহার হবে)</label>
        <textarea id="deliveryAddress" rows="2"></textarea>
        <label>নোট (ঐচ্ছিক)</label>
        <textarea id="orderNote" rows="2" placeholder="বিশেষ কোনো নির্দেশনা থাকলে লিখুন"></textarea>
        <button class="btn btn-primary btn-block" id="placeOrderBtn" style="margin-top:14px;" ${belowMin ? 'disabled' : ''}>${t('checkout')}</button>
      </div>
    `}
  `;

  const list = document.getElementById('cartList');
  if (list) {
    list.addEventListener('click', (e) => {
      const item = e.target.closest('.cart-item');
      if (!item) return;
      const id = item.dataset.id;
      const cur = state.cart[id] || 0;
      if (e.target.classList.contains('inc')) setCartQty(id, cur + 1);
      if (e.target.classList.contains('dec')) setCartQty(id, cur - 1);
      renderCart();
    });
  }

  const placeBtn = document.getElementById('placeOrderBtn');
  if (placeBtn) {
    placeBtn.addEventListener('click', async () => {
      if (state.role !== 'customer') {
        toast(t('login_to_order'));
        location.hash = '#/login';
        return;
      }
      placeBtn.disabled = true;
      placeBtn.textContent = t('placing_order');
      try {
        const payload = {
          items: items.map((x) => ({ productId: x.product._id, qty: x.qty })),
          note: document.getElementById('orderNote').value,
          deliveryAddress: document.getElementById('deliveryAddress').value,
        };
        const order = await api('/orders', { method: 'POST', body: payload });
        state.cart = {};
        saveCart();
        toast(`✅ অর্ডার সফল হয়েছে! অর্ডার নং: ${order.orderNo}`);
        location.hash = '#/orders';
      } catch (err) {
        toast(err.message);
        placeBtn.disabled = false;
        placeBtn.textContent = t('checkout');
      }
    });
  }
}

/* ================= ORDERS (customer) ================= */
route('/orders', async () => {
  if (state.role === 'admin') {
    APP.innerHTML = `
      <div class="section-title">${t('orders_title')}</div>
      <div class="empty-state"><div class="icon">📦</div>প্রিভিউ মোডে অর্ডার লিস্ট দেখানো যায় না — এটা প্রতিটি কাস্টমারের নিজস্ব তথ্য।</div>
    `;
    return;
  }
  requireCustomer();
  const orders = await api('/orders/mine');
  const statusLabel = {
    pending: t('cust_status_pending'), confirmed: t('cust_status_confirmed'), processing: t('cust_status_processing'),
    shipped: t('cust_status_shipped'), delivered: t('cust_status_delivered'), cancelled: t('cust_status_cancelled'),
  };
  APP.innerHTML = `
    <div class="section-title">${t('orders_title')}</div>
    ${orders.length === 0 ? `<div class="empty-state"><div class="icon">📦</div>${t('no_orders')}</div>` : groupOrdersByDay(orders).map((g) => `
      <div class="day-group-label">${g.label}</div>
      ${g.orders.map((o) => `
        <div class="order-card" data-id="${o._id}">
          <div class="oc-head">
            <b>${o.orderNo}</b>
            <span class="status-badge status-${o.status}">${statusLabel[o.status] || o.status}</span>
          </div>
          <div class="muted" style="font-size:12.5px; margin-bottom:6px;">${new Date(o.createdAt).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}</div>
          ${o.items.map((it) => `<div style="font-size:13.5px;">${escapeHtml(it.name)} × ${it.qty}</div>`).join('')}
          <div class="summary-row total" style="border-top:1px dashed #d8dcda; margin-top:8px; padding-top:8px;">
            <span>${t('total')}</span><span>${money(o.total)}</span>
          </div>
          <div style="display:flex; gap:8px; margin-top:10px;">
            <a href="#/invoice/${o._id}" class="btn btn-outline btn-sm" style="flex:1;">${t('view_invoice')}</a>
            ${o.status === 'pending' ? `<a href="#/edit-order/${o._id}" class="btn btn-primary btn-sm" style="flex:1;">✏️ এডিট করুন</a>` : ''}
          </div>
          ${o.status === 'pending' ? `<button class="btn btn-danger btn-sm btn-block cancelOrderBtn" style="margin-top:8px;">✕ অর্ডার বাতিল করুন</button>` : ''}
        </div>
      `).join('')}
    `).join('')}
  `;
  document.querySelectorAll('.cancelOrderBtn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const card = btn.closest('.order-card');
      const id = card.dataset.id;
      if (!confirm('আপনি কি নিশ্চিতভাবে এই অর্ডারটি বাতিল করতে চান?')) return;
      try {
        await api(`/orders/${id}/cancel`, { method: 'PATCH' });
        toast('অর্ডার বাতিল হয়েছে');
        router();
      } catch (err) { toast(err.message); }
    });
  });
});

/* ================= EDIT ORDER (customer — only while status is pending) ================= */
route('/edit-order', async (rest) => {
  const isAdminEditing = state.role === 'admin';
  if (isAdminEditing) requireAdmin();
  else requireCustomer();

  const id = rest[0];
  if (!id) { location.hash = isAdminEditing ? '#/admin' : '#/orders'; return; }
  const order = await api(`/orders/${id}`);
  await ensureProductsCached(order.items.map((it) => it.product));
  if (!isAdminEditing && order.status !== 'pending') {
    toast('শুধুমাত্র পেন্ডিং অর্ডার সম্পাদনা করা যায়');
    location.hash = '#/orders';
    return;
  }

  // Working copy: { productId: { name, price, unit, qty, maxStock } }
  const draft = {};
  for (const it of order.items) {
    const liveProduct = state.products.find((p) => p._id === it.product);
    draft[it.product] = {
      name: it.name, price: it.price, unit: it.unit, qty: it.qty,
      maxStock: liveProduct ? liveProduct.stock + it.qty : it.qty, // current stock + what this order already holds
    };
  }
  const backHash = isAdminEditing ? '#/admin' : '#/orders';

  async function renderEditOrder(searchQuery = '') {
    const ids = Object.keys(draft);
    const total = ids.reduce((s, id) => s + draft[id].price * draft[id].qty, 0);
    let searchResults = [];
    if (searchQuery.trim()) {
      const res = await api(`/products?q=${encodeURIComponent(searchQuery.trim())}&limit=8`, { auth: false });
      cacheProducts(res.items);
      searchResults = res.items.filter((p) => !draft[p._id] && p.inStock && p.stock > 0);
    }

    APP.innerHTML = `
      <div class="section-title">✏️ অর্ডার এডিট করুন — ${order.orderNo}</div>
      ${ids.length === 0 ? `<div class="empty-state">অন্তত একটি পণ্য রাখতে হবে</div>` : `
        <div class="card" id="editItemsList">
          ${ids.map((pid) => `
            <div class="cart-item" data-pid="${pid}">
              <div>
                <div class="ci-name">${escapeHtml(draft[pid].name)}</div>
                <div class="ci-sub">${money(draft[pid].price)} × ${draft[pid].qty} = ${money(draft[pid].price * draft[pid].qty)}</div>
              </div>
              <div class="qty-row">
                <button class="dec">−</button>
                <span class="qty-val">${draft[pid].qty}</span>
                <button class="inc">+</button>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="card">
          <div class="summary-row total"><span>${t('total')}</span><span>${money(total)}</span></div>
        </div>
      `}

      <div class="section-title" style="font-size:14px; margin-top:18px;">+ নতুন প্রোডাক্ট যোগ করুন</div>
      <div class="search-bar">
        <input type="text" id="editProductSearch" placeholder="ওষুধ বা কোম্পানির নাম লিখুন..." value="${escapeHtml(searchQuery)}">
      </div>
      ${searchQuery.trim() ? `
        <div class="card" id="editSearchResults" style="padding:6px;">
          ${searchResults.length === 0
            ? '<div class="empty-state" style="padding:16px;">😕 কোনো প্রোডাক্ট পাওয়া যায়নি</div>'
            : searchResults.map((p) => `
                <div class="cart-item" data-add-id="${p._id}" style="cursor:pointer;">
                  <div>
                    <div class="ci-name">${escapeHtml(p.name)}</div>
                    <div class="ci-sub">${escapeHtml(p.companyName || '')} • ${money(p.price)}</div>
                  </div>
                  <button class="btn btn-primary btn-sm">+ যোগ করুন</button>
                </div>
              `).join('')}
        </div>
      ` : ''}

      <div class="card">
        <label>${t('delivery_address')}</label>
        <textarea id="editAddress" rows="2">${escapeHtml(order.deliveryAddress || '')}</textarea>
        <label>নোট</label>
        <textarea id="editNote" rows="2">${escapeHtml(order.note || '')}</textarea>
        <button class="btn btn-primary btn-block" id="saveEditBtn" style="margin-top:14px;" ${ids.length === 0 ? 'disabled' : ''}>পরিবর্তন সংরক্ষণ করুন</button>
        <a href="${backHash}" class="btn btn-outline btn-block" style="margin-top:10px;">বাতিল</a>
      </div>
    `;

    const list = document.getElementById('editItemsList');
    if (list) {
      list.addEventListener('click', (e) => {
        const row = e.target.closest('.cart-item');
        if (!row) return;
        const pid = row.dataset.pid;
        if (e.target.classList.contains('inc')) {
          if (draft[pid].qty >= draft[pid].maxStock) { toast('স্টক সীমা শেষ'); return; }
          draft[pid].qty += 1;
        } else if (e.target.classList.contains('dec')) {
          draft[pid].qty -= 1;
          if (draft[pid].qty <= 0) delete draft[pid];
        }
        renderEditOrder(searchQuery);
      });
    }

    const searchInput = document.getElementById('editProductSearch');
    let editSearchDebounce;
    searchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      clearTimeout(editSearchDebounce);
      editSearchDebounce = setTimeout(async () => {
        await renderEditOrder(val);
        const input = document.getElementById('editProductSearch');
        input.focus();
        input.setSelectionRange(val.length, val.length);
      }, 300);
    });
    const results = document.getElementById('editSearchResults');
    if (results) {
      results.addEventListener('click', (e) => {
        const row = e.target.closest('[data-add-id]');
        if (!row) return;
        const pid = row.dataset.addId;
        const product = state.products.find((p) => p._id === pid);
        if (!product) return;
        draft[pid] = { name: product.name, price: product.price, unit: product.unit, qty: 1, maxStock: product.stock };
        toast(`${product.name} যোগ হয়েছে`);
        renderEditOrder('');
      });
    }

    const saveBtn = document.getElementById('saveEditBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const items = Object.keys(draft).map((pid) => ({ productId: pid, qty: draft[pid].qty }));
        saveBtn.disabled = true;
        saveBtn.textContent = 'সংরক্ষণ হচ্ছে...';
        try {
          await api(`/orders/${id}/edit`, {
            method: 'PUT',
            body: { items, note: document.getElementById('editNote').value, deliveryAddress: document.getElementById('editAddress').value },
          });
          toast('অর্ডার আপডেট হয়েছে');
          location.hash = backHash;
        } catch (err) {
          toast(err.message);
          saveBtn.disabled = false;
          saveBtn.textContent = 'পরিবর্তন সংরক্ষণ করুন';
        }
      });
    }
  }

  renderEditOrder();
});

/* ================= INVOICE (print) ================= */
route('/invoice', async (rest) => {
  const id = rest[0];
  if (!state.token || (state.role !== 'customer' && state.role !== 'admin')) {
    location.hash = '#/login';
    throw new Error('লগইন প্রয়োজন');
  }
  if (!id) { APP.innerHTML = '<div class="empty-state">অর্ডার খুঁজে পাওয়া যায়নি</div>'; return; }
  const [order, settings] = await Promise.all([
    api(`/orders/${id}`),
    api('/settings', { auth: false }),
  ]);
  renderInvoice(order, settings);
});

function renderInvoice(o, settings) {
  const cust = o.customer || {};
  const orderDate = new Date(o.createdAt).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' });
  const rows = o.items;
  const totalSavings = rows.reduce((sum, it) => {
    const mrp = Number(it.mrp) || 0;
    return mrp > it.price ? sum + (mrp - it.price) * it.qty : sum;
  }, 0);

  APP.innerHTML = `
    <div class="invoice-box">
      <div class="no-print" style="display:flex; gap:8px; margin-bottom:14px;">
        <button class="btn btn-primary btn-sm" id="printInvoiceBtn">🖨️ প্রিন্ট করুন</button>
        <a href="javascript:history.back()" class="btn btn-outline btn-sm">← ফিরে যান</a>
      </div>
      <div class="card invoice-doc">
        <div class="invoice-title-block">
          <div class="inv-shop-name">${escapeHtml(settings.shopName || 'ঔষধ ঘর')}</div>
          ${settings.landingContactAddress ? `<div class="inv-shop-line">${escapeHtml(settings.landingContactAddress)}</div>` : ''}
          ${(settings.hotline || settings.landingContactEmail) ? `<div class="inv-shop-line inv-shop-contact">
            ${settings.hotline ? `<b>Phone:</b> ${escapeHtml(settings.hotline)}` : ''}${settings.hotline && settings.landingContactEmail ? '&nbsp;&nbsp;' : ''}${settings.landingContactEmail ? `<b>Email:</b> ${escapeHtml(settings.landingContactEmail)}` : ''}
          </div>` : ''}
        </div>
        <hr class="inv-hr">
        <div class="invoice-order-box">
          <div><b>Order ID:</b> ${escapeHtml(o.orderNo)} &nbsp;•&nbsp; <b>Date:</b> ${orderDate}</div>
          <div><b>Shop:</b> ${escapeHtml(cust.pharmacyName || '-')} &nbsp;•&nbsp; <b>Owner:</b> ${escapeHtml(cust.ownerName || '-')}</div>
          ${cust.phone ? `<div><b>Phone:</b> ${escapeHtml(cust.phone)}</div>` : ''}
          <div><b>Address:</b> ${escapeHtml(o.deliveryAddress || cust.address || '-')}</div>
        </div>
        <table class="invoice-table-v2">
          <thead><tr><th class="col-sr">Sr.</th><th>Particular</th><th class="col-qty">Qty</th><th class="col-rate">MRP</th><th class="col-rate">Rate</th><th class="col-disc">Discount</th><th class="col-amt">Amount</th></tr></thead>
          <tbody>
            ${rows.map((it, i) => {
              const mrp = Number(it.mrp) || 0;
              const hasDiscount = mrp > it.price;
              const discPct = hasDiscount ? Math.round(((mrp - it.price) / mrp) * 100) : 0;
              const formLabel = detectFormLabel(it);
              return `
              <tr>
                <td class="col-sr">${i + 1}</td>
                <td>${escapeHtml(it.name)}${formLabel ? ` <span class="inv-form-tag">(${escapeHtml(formLabel)})</span>` : ''}</td>
                <td class="col-qty">${it.qty}</td>
                <td class="col-rate">${mrp ? Number(mrp).toFixed(2) : '-'}</td>
                <td class="col-rate">${Number(it.price).toFixed(2)}</td>
                <td class="col-disc">${hasDiscount ? `${discPct}%` : '-'}</td>
                <td class="col-amt">${Number(it.price * it.qty).toFixed(2)}</td>
              </tr>
            `;
            }).join('')}
            <tr class="inv-total-row">
              <td colspan="6" class="inv-total-label">Total</td>
              <td class="col-amt">৳ ${Number(o.total).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
        ${totalSavings > 0 ? `<div class="inv-savings-line">আপনি এই অর্ডারে সাশ্রয় করেছেন ৳ ${totalSavings.toFixed(2)}</div>` : ''}
        ${o.note ? `<div style="margin-top:14px; font-size:13px;"><b>নোট:</b> ${escapeHtml(o.note)}</div>` : ''}
        <div class="invoice-footer-row">
          <div>For <b>${escapeHtml(settings.shopName || 'ঔষধ ঘর')}</b></div>
          <div>Created By <b>${escapeHtml((state.role === 'admin' && state.admin && state.admin.name) || settings.shopName || '')}</b></div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('printInvoiceBtn').addEventListener('click', () => window.print());
}

/* ================= NOTIFICATIONS ================= */
route('/notifications', async () => {
  if (state.role === 'admin') {
    APP.innerHTML = `
      <div class="section-title">🔔 নোটিফিকেশন</div>
      <div class="empty-state"><div class="icon">🔔</div>প্রিভিউ মোডে নোটিফিকেশন দেখানো যায় না — এটা প্রতিটি কাস্টমারের নিজস্ব তথ্য।</div>
    `;
    return;
  }
  if (state.role !== 'customer') { location.hash = '#/login'; return; }
  const list = await api('/notifications');
  APP.innerHTML = `
    <div class="section-title">🔔 নোটিফিকেশন</div>
    ${list.length === 0 ? `<div class="empty-state"><div class="icon">🔔</div>কোনো নোটিফিকেশন নেই</div>` : list.map((n) => `
      <div class="card">
        <b>${escapeHtml(n.title)}</b>
        <div class="muted" style="font-size:13px; margin-top:4px;">${escapeHtml(n.message)}</div>
      </div>
    `).join('')}
  `;
});

/* ================= PROFILE ================= */
route('/profile', async () => {
  if (state.role !== 'customer' || !state.token) {
    renderGuestProfile();
    return;
  }
  const [{ customer }, orders] = await Promise.all([api('/auth/me'), api('/orders/mine').catch(() => [])]);
  state.customer = customer;
  renderProfile(customer, orders);
});

function renderGuestProfile() {
  APP.innerHTML = `
    <div class="center-screen">
      <div class="card auth-card" style="text-align:center;">
        <div style="font-size:40px; margin-bottom:10px;">👤</div>
        <div class="section-title">আপনি লগইন করেননি</div>
        <a href="#/login" class="btn btn-primary btn-block">${t('login')}</a>
        <a href="#/register" class="btn btn-outline btn-block" style="margin-top:10px;">${t('register')}</a>
        <div style="margin-top:16px; border-top:1px solid #eef0ef; padding-top:14px; display:flex; flex-direction:column; gap:8px;">
          <a href="/home/landing.html" class="muted" style="font-size:13px;">🌐 আমাদের সম্পর্কে বিস্তারিত জানুন</a>
          <a href="#/admin-login" class="muted" style="font-size:13px;">অ্যাডমিন লগইন →</a>
        </div>
      </div>
      <button class="btn btn-primary btn-block installAppBtn hidden" style="margin-top:14px;">📲 হোম স্ক্রিনে অ্যাপ যোগ করুন</button>
      <div class="card auth-card" style="margin-top:14px;">
        <div class="row-between">
          <span>${t('dark_mode')}</span>
          <label class="theme-switch">
            <input type="checkbox" id="themeToggleGuest" ${localStorage.getItem('og_theme') === 'dark' ? 'checked' : ''}>
            <span class="switch-slider"></span>
          </label>
        </div>
      </div>
    </div>
  `;
  document.getElementById('themeToggleGuest').addEventListener('change', (e) => {
    applyTheme(e.target.checked ? 'dark' : 'light');
  });
  wireInstallButtons();
}

function renderProfile(c, orders = []) {
  const statusText = { pending: '⏳ আপনার অ্যাকাউন্ট অনুমোদনের অপেক্ষায় আছে', blocked: '⛔ আপনার অ্যাকাউন্ট ব্লক করা হয়েছে', approved: '' };
  const totalOrders = orders.length;
  const totalSpent = orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0);
  const initial = (c.pharmacyName || '?').trim().charAt(0).toUpperCase();

  APP.innerHTML = `
    ${c.status !== 'approved' ? `<div class="announce" style="background:#fff4e0; color:#c88b12; border-color:#f2dfb0;">${statusText[c.status]}</div>` : ''}

    <div class="card profile-header">
      <div class="profile-avatar">${escapeHtml(initial)}</div>
      <div style="flex:1; min-width:0;">
        <div class="row-between">
          <div style="font-size:17px; font-weight:700;">${escapeHtml(c.pharmacyName)}</div>
          <span class="pill pill-${c.status}">${c.status === 'approved' ? 'অনুমোদিত' : c.status === 'pending' ? 'পেন্ডিং' : 'ব্লকড'}</span>
        </div>
        <div class="muted" style="font-size:13.5px;">${escapeHtml(c.ownerName)} • ${escapeHtml(c.phone)}</div>
      </div>
    </div>

    <div class="profile-stats">
      <a href="#/orders" class="profile-stat-box">
        <div class="ps-num">${totalOrders}</div>
        <div class="ps-label">মোট অর্ডার</div>
      </a>
      <div class="profile-stat-box">
        <div class="ps-num">${money(totalSpent)}</div>
        <div class="ps-label">মোট কেনাকাটা</div>
      </div>
    </div>

    <details class="card profile-accordion">
      <summary><span class="sum-label"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg> প্রোফাইল সম্পাদনা</span></summary>
      <div class="profile-accordion-body">
        <label>ফার্মেসির নাম</label>
        <input id="p_pharmacyName" value="${escapeHtml(c.pharmacyName)}">
        <label>মালিকের নাম</label>
        <input id="p_ownerName" value="${escapeHtml(c.ownerName)}">
        <label>ঠিকানা</label>
        <textarea id="p_address" rows="2">${escapeHtml(c.address || '')}</textarea>
        <label>এলাকা</label>
        <input id="p_area" value="${escapeHtml(c.area || '')}">
        <label>ট্রেড লাইসেন্স নং</label>
        <input id="p_tradeLicense" value="${escapeHtml(c.tradeLicense || '')}">
        <button class="btn btn-primary btn-block" id="saveProfileBtn" style="margin-top:14px;">সংরক্ষণ করুন</button>
      </div>
    </details>

    <details class="card profile-accordion">
      <summary><span class="sum-label"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10.5" width="16" height="9.5" rx="2"/><path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5"/></svg> পাসওয়ার্ড পরিবর্তন</span></summary>
      <div class="profile-accordion-body">
        <label>বর্তমান পাসওয়ার্ড</label>
        <div class="pwd-wrap"><input type="password" id="p_curPass"><button type="button" class="pwd-toggle" data-target="p_curPass" tabindex="-1">👁️</button></div>
        <label>নতুন পাসওয়ার্ড</label>
        <div class="pwd-wrap"><input type="password" id="p_newPass"><button type="button" class="pwd-toggle" data-target="p_newPass" tabindex="-1">👁️</button></div>
        <button class="btn btn-outline btn-block" id="changePassBtn" style="margin-top:14px;">পাসওয়ার্ড পরিবর্তন করুন</button>
      </div>
    </details>

    <div class="card">
      <div class="section-title" style="display:flex; align-items:center; gap:8px;"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.56V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.56V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.56 1H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1Z"/></svg> সেটিংস</div>
      <div class="row-between" style="padding:6px 0;">
        <span style="display:flex; align-items:center; gap:8px;"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--muted);"><path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11Z"/></svg> ${t('dark_mode')}</span>
        <label class="theme-switch">
          <input type="checkbox" id="themeToggle" ${localStorage.getItem('og_theme') === 'dark' ? 'checked' : ''}>
          <span class="switch-slider"></span>
        </label>
      </div>
      <div class="profile-links">
        <button class="installAppBtn hidden"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="2"/><path d="M11.5 18.5h1"/></svg> হোম স্ক্রিনে অ্যাপ যোগ করুন</button>
        <a href="/home/landing.html"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z"/></svg> আমাদের সম্পর্কে বিস্তারিত জানুন</a>
      </div>
    </div>

    <button class="btn btn-danger btn-block" id="logoutBtn">${t('logout')}</button>
  `;

  document.getElementById('themeToggle').addEventListener('change', (e) => {
    applyTheme(e.target.checked ? 'dark' : 'light');
  });

  document.getElementById('saveProfileBtn').addEventListener('click', async () => {
    try {
      await api('/customers/me', {
        method: 'PUT',
        body: {
          pharmacyName: document.getElementById('p_pharmacyName').value,
          ownerName: document.getElementById('p_ownerName').value,
          address: document.getElementById('p_address').value,
          area: document.getElementById('p_area').value,
          tradeLicense: document.getElementById('p_tradeLicense').value,
        },
      });
      toast('প্রোফাইল সংরক্ষণ হয়েছে');
      router();
    } catch (err) { toast(err.message); }
  });

  document.getElementById('changePassBtn').addEventListener('click', async () => {
    try {
      await api('/customers/me/password', {
        method: 'PUT',
        body: {
          currentPassword: document.getElementById('p_curPass').value,
          newPassword: document.getElementById('p_newPass').value,
        },
      });
      toast('পাসওয়ার্ড পরিবর্তন হয়েছে');
    } catch (err) { toast(err.message); }
  });

  document.getElementById('logoutBtn').addEventListener('click', logout);
  wireInstallButtons();
  wirePasswordToggles();
}

/* ================= LOGIN / REGISTER (customer) ================= */
route('/login', async () => {
  APP.innerHTML = `
    <div class="center-screen">
      <div class="card auth-card">
        <div class="section-title" style="text-align:center;">💊 ঔষধ ঘর - লগইন</div>
        <div class="muted" style="text-align:center; font-size:12.5px; margin-top:-8px; margin-bottom:6px;">কাস্টমার ও অ্যাডমিন — উভয়েই এখান থেকে লগইন করতে পারবেন</div>
        <label>মোবাইল/ফোন নম্বর</label>
        <input id="l_phone" placeholder="01XXXXXXXXX">
        <label>পাসওয়ার্ড</label>
        <div class="pwd-wrap"><input id="l_pass" type="password"><button type="button" class="pwd-toggle" data-target="l_pass" tabindex="-1">👁️</button></div>
        <button class="btn btn-primary btn-block" id="loginBtn" style="margin-top:16px;">লগইন করুন</button>
        <div class="link-row">অ্যাকাউন্ট নেই? <a href="#/register" class="link-danger">রেজিস্ট্রেশন করুন</a></div>
      </div>
    </div>
  `;
  document.getElementById('loginBtn').addEventListener('click', async () => {
    try {
      const data = await api('/auth/login', {
        method: 'POST', auth: false,
        body: { phone: document.getElementById('l_phone').value, password: document.getElementById('l_pass').value },
      });
      if (data.role === 'admin') {
        setAuth(data.token, 'admin');
        state.admin = data.admin;
        toast(`স্বাগতম, ${data.admin.name}`);
        location.hash = '#/admin';
      } else {
        setAuth(data.token, 'customer');
        state.customer = data.customer;
        toast(`স্বাগতম, ${data.customer.pharmacyName}`);
        location.hash = '#/shop';
      }
    } catch (err) { toast(err.message); }
  });
  wirePasswordToggles();
});

route('/register', async () => {
  APP.innerHTML = `
    <div class="center-screen">
      <div class="card auth-card">
        <div class="section-title" style="text-align:center;">💊 নতুন অ্যাকাউন্ট খুলুন</div>
        <label>ফার্মেসির নাম *</label>
        <input id="r_pharmacyName">
        <label>মালিকের নাম *</label>
        <input id="r_ownerName">
        <label>মোবাইল নম্বর *</label>
        <input id="r_phone">
        <label>পাসওয়ার্ড *</label>
        <div class="pwd-wrap"><input id="r_password" type="password"><button type="button" class="pwd-toggle" data-target="r_password" tabindex="-1">👁️</button></div>
        <label>ঠিকানা</label>
        <textarea id="r_address" rows="2"></textarea>
        <label>এলাকা</label>
        <input id="r_area">
        <button class="btn btn-primary btn-block" id="registerBtn" style="margin-top:16px;">রেজিস্ট্রেশন করুন</button>
        <div class="link-row">আগে থেকে অ্যাকাউন্ট আছে? <a href="#/login">লগইন করুন</a></div>
      </div>
    </div>
  `;
  document.getElementById('registerBtn').addEventListener('click', async () => {
    try {
      const { token, customer } = await api('/auth/register', {
        method: 'POST', auth: false,
        body: {
          pharmacyName: document.getElementById('r_pharmacyName').value,
          ownerName: document.getElementById('r_ownerName').value,
          phone: document.getElementById('r_phone').value,
          password: document.getElementById('r_password').value,
          address: document.getElementById('r_address').value,
          area: document.getElementById('r_area').value,
        },
      });
      setAuth(token, 'customer');
      state.customer = customer;
      toast('রেজিস্ট্রেশন সফল হয়েছে! অ্যাডমিন অনুমোদনের পর অর্ডার করতে পারবেন।');
      location.hash = '#/profile';
    } catch (err) { toast(err.message); }
  });
  wirePasswordToggles();
});

/* ================= ADMIN LOGIN (alias — same unified login now handles both roles) ================= */
route('/admin-login', async () => {
  location.hash = '#/login';
});

/* ================= ADMIN DASHBOARD ================= */
route('/admin', async () => {
  requireAdmin();
  renderAdminShell('dashboard');
});

const ADMIN_NAV = [
  { tab: 'dashboard', label: () => t('admin_dashboard'), icon: '📊' },
  { group: () => t('admin_group_catalog'), items: [
    { tab: 'products', label: () => t('admin_products'), icon: '📦' },
    { tab: 'companies', label: () => t('admin_companies'), icon: '🏢' },
    { tab: 'bulkimport', label: () => t('admin_bulkimport'), icon: '📥' },
    { tab: 'bulkimage', label: () => t('admin_bulkimage'), icon: '🖼️' },
  ] },
  { group: () => t('admin_group_sales'), items: [
    { tab: 'orders', label: () => t('admin_orders'), icon: '🧾' },
    { tab: 'neworder', label: () => t('admin_neworder'), icon: '➕' },
    { tab: 'customers', label: () => t('admin_customers'), icon: '👥' },
  ] },
  { group: () => t('admin_group_inventory'), items: [
    { tab: 'stockout', label: () => t('admin_stockout'), icon: '⚠️' },
  ] },
  { group: () => t('admin_group_other'), items: [
    { tab: 'announcements', label: () => t('admin_announcements'), icon: '🔔' },
    { tab: 'landing', label: () => t('admin_landing'), icon: '🖼️' },
    { tab: 'admins', label: () => t('admin_admins'), icon: '🔑' },
    { tab: 'settings', label: () => t('admin_settings'), icon: '⚙️' },
  ] },
];
function flattenAdminNav() {
  const flat = [];
  ADMIN_NAV.forEach((entry) => (entry.group ? entry.items.forEach((it) => flat.push(it)) : flat.push(entry)));
  return flat;
}
function renderAdminShell(activeTab) {
  APP.classList.add('admin-active');
  const allItems = flattenAdminNav();
  const activeItem = allItems.find((m) => m.tab === activeTab) || allItems[0];

  function navHtml() {
    return ADMIN_NAV.map((entry) => {
      if (entry.group) {
        return `
          <div class="admin-nav-group-label">${escapeHtml(entry.group())}</div>
          ${entry.items.map((it) => navItemHtml(it)).join('')}
        `;
      }
      return navItemHtml(entry);
    }).join('');
  }
  function navItemHtml(it) {
    return `<a class="admin-nav-item ${it.tab === activeTab ? 'active' : ''}" data-tab="${it.tab}"><span class="ani-icon">${it.icon}</span>${escapeHtml(it.label())}</a>`;
  }

  APP.innerHTML = `
    <div class="admin-layout">
      <aside class="admin-sidebar" id="adminSidebar">
        <div class="admin-brand">
          <img src="/icons/icon-192.png" class="admin-brand-logo" alt="logo">
          <div>
            <div class="admin-brand-name">${t('admin_brand_name')}</div>
            <div class="admin-brand-sub">${escapeHtml((state.settings && state.settings.shopName) || 'পাইকারি ওষুধ অর্ডার')}</div>
          </div>
        </div>
        <nav class="admin-nav" id="adminNav">${navHtml()}</nav>
      </aside>
      <div class="admin-main">
        <div class="admin-main-topbar">
          <button class="admin-sidebar-toggle" id="adminSidebarToggle" aria-label="Menu">☰</button>
          <div class="admin-page-title" id="adminPageTitle">${escapeHtml(activeItem.label())}</div>
          <button class="btn btn-outline btn-sm" id="adminLogoutBtn">${t('logout')}</button>
        </div>
        <div id="adminContent" class="card"></div>
      </div>
      <div class="admin-sidebar-overlay" id="adminSidebarOverlay"></div>
    </div>
  `;
  document.getElementById('adminLogoutBtn').addEventListener('click', logout);

  const sidebar = document.getElementById('adminSidebar');
  const overlay = document.getElementById('adminSidebarOverlay');
  document.getElementById('adminSidebarToggle').addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show', sidebar.classList.contains('open'));
  });
  overlay.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('show'); });

  document.getElementById('adminNav').addEventListener('click', (e) => {
    const item = e.target.closest('.admin-nav-item');
    if (!item) return;
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
    loadAdminTab(item.dataset.tab);
  });

  loadAdminTab(activeTab);
}

async function loadAdminTab(tab, opts = {}) {
  const allItems = flattenAdminNav();
  const matched = allItems.find((m) => m.tab === tab);
  document.querySelectorAll('#adminNav .admin-nav-item').forEach((el) => el.classList.toggle('active', el.dataset.tab === tab));
  const titleEl = document.getElementById('adminPageTitle');
  if (matched && titleEl) titleEl.textContent = matched.label();
  const box = document.getElementById('adminContent');
  box.innerHTML = 'লোড হচ্ছে...';
  if (tab === 'dashboard') return renderAdminDashboard(box);
  if (tab === 'products') return renderAdminProducts(box, !!opts.outOfStockOnly);
  if (tab === 'bulkimport') return renderAdminBulkImport(box);
  if (tab === 'bulkimage') return renderAdminBulkImage(box);
  if (tab === 'stockout') return renderAdminStockoutGrouped(box);
  if (tab === 'orders') return renderAdminOrders(box);
  if (tab === 'neworder') return renderAdminNewOrder(box);
  if (tab === 'customers') return renderAdminCustomers(box);
  if (tab === 'companies') return renderAdminCompanies(box);
  if (tab === 'announcements') return renderAdminAnnouncements(box);
  if (tab === 'landing') return renderAdminLanding(box);
  if (tab === 'admins') return renderAdminAdmins(box);
  if (tab === 'settings') return renderAdminSettings(box);
}

/* ----- Admin: Dashboard ----- */
async function renderAdminDashboard(box) {
  const [orders, customers, productsMeta, stockoutMeta] = await Promise.all([
    api('/orders'),
    api('/customers'),
    api('/products/admin?limit=1'),
    api('/products/admin?limit=1&inStock=false'),
  ]);
  const now = new Date();
  const isSameDay = (d, ref) => d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
  const isCounted = (o) => o.status !== 'cancelled';
  const sumTotal = (list) => list.filter(isCounted).reduce((s, o) => s + o.total, 0);
  const countByStatus = (list, status) => list.filter((o) => o.status === status).length;

  const todayOrders = orders.filter((o) => isSameDay(new Date(o.createdAt), now));
  const totalSales = sumTotal(orders);

  // Last 7 days sales, oldest to newest, for the bar chart
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayOrders = orders.filter((o) => isSameDay(new Date(o.createdAt), d));
    days.push({ label: `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, total: sumTotal(dayOrders) });
  }
  const maxDay = Math.max(1, ...days.map((d) => d.total));

  const stat = (label, value) => `
    <div class="dash-stat-card"><div class="dsc-label">${label}</div><div class="dsc-value">${value}</div></div>
  `;

  box.innerHTML = `
    <div class="dash-grid-cards">
      ${stat(t('dash_total_sales'), money(totalSales))}
      ${stat(t('dash_today_sales'), money(sumTotal(todayOrders)))}
      ${stat(t('dash_total_orders'), orders.length)}
      ${stat(t('dash_pending_orders'), countByStatus(orders, 'pending'))}
      ${stat(t('dash_complete_orders'), countByStatus(orders, 'delivered'))}
      ${stat(t('dash_total_customers'), customers.length)}
      ${stat(t('dash_total_products'), productsMeta.total)}
      ${stat(t('dash_stock_out'), stockoutMeta.total)}
    </div>
    <div class="section-title" style="border-left:4px solid var(--admin-accent); padding-left:8px; margin:20px 0 16px;">${t('dash_sales_7days')}</div>
    <div class="dash-bar-chart">
      ${days.map((d) => `
        <div class="dash-bar-col">
          <div class="dash-bar-value">${d.total > 0 ? '৳' + d.total.toLocaleString('en-US') : ''}</div>
          <div class="dash-bar" style="height:${Math.max(4, Math.round((d.total / maxDay) * 140))}px;"></div>
          <div class="dash-bar-label">${d.label}</div>
        </div>
      `).join('')}
    </div>
    <div class="muted" style="font-size:12px; margin-top:10px;">
      ${t('dash_lowstock_note')}
    </div>
  `;
}


/* ----- Admin: Bulk Import (Excel/CSV) ----- */
const BULK_HEADER_MAP = {
  'নাম': 'name', 'name': 'name',
  'কোম্পানি': 'companyName', 'company': 'companyName',
  'ক্যাটাগরি': 'category', 'category': 'category',
  'ইউনিট': 'unit', 'unit': 'unit',
  'ধরণ': 'form', 'ধরন': 'form', 'form': 'form',
  'mrp': 'mrp', 'MRP': 'mrp',
  'ছাড় (%)': 'discountPercent', 'discount': 'discountPercent', 'ছাড়': 'discountPercent',
  'স্টক': 'stock', 'stock': 'stock',
  'generic': 'description', 'Generic': 'description',
};

function renderAdminBulkImport(box) {
  let parsedRows = [];

  box.innerHTML = `
    <div class="section-title">${t('bulkimport_title')}</div>
    <div class="muted" style="font-size:12.5px; margin-bottom:12px; white-space:pre-line;">${t('bulkimport_instructions')}</div>
    <input type="file" id="bulkFileInput" accept=".xlsx,.xls,.csv">
    <div id="bulkPreviewArea" style="margin-top:14px;"></div>
  `;

  document.getElementById('bulkFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'array' });
        // Merge every sheet's rows keyed by name — lets a "generic name" sheet
        // (like the reference sheet ACI-style lists ship with) fill in extra
        // fields (e.g. description) for rows already found in the main sheet.
        const merged = {};
        wb.SheetNames.forEach((sheetName) => {
          const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
          raw.forEach((row) => {
            const mapped = {};
            Object.keys(row).forEach((h) => {
              const key = BULK_HEADER_MAP[h.trim()];
              if (key) mapped[key] = row[h];
            });
            if (!mapped.name) return;
            const nameKey = String(mapped.name).trim().toLowerCase();
            merged[nameKey] = { ...(merged[nameKey] || {}), ...mapped };
          });
        });
        parsedRows = Object.values(merged).filter((r) => r.name && r.mrp);
        renderBulkPreview();
      } catch (err) {
        toast(t('toast_file_read_error') + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  });

  function renderBulkPreview() {
    const area = document.getElementById('bulkPreviewArea');
    if (parsedRows.length === 0) {
      area.innerHTML = `<div class="empty-state">${t('no_valid_products_found')}</div>`;
      return;
    }
    area.innerHTML = `
      <div class="card">
        ${t('products_found_sample').replace('{n}', `<b>${parsedRows.length}</b>`)}
        <div style="overflow-x:auto; margin-top:8px;">
          <table>
            <thead><tr><th>${t('th_name')}</th><th>${t('th_company')}</th><th>${t('th_mrp')}</th><th>${t('th_discount')}</th><th>${t('th_rate_calc')}</th><th>${t('th_stock')}</th></tr></thead>
            <tbody>
              ${parsedRows.slice(0, 8).map((r) => {
                const mrp = Number(r.mrp) || 0;
                const disc = Number(r.discountPercent) || 0;
                const rate = Math.round(mrp * (1 - disc / 100) * 100) / 100;
                return `<tr><td>${escapeHtml(String(r.name))}</td><td>${escapeHtml(String(r.companyName || '-'))}</td><td>${mrp}</td><td>${disc}%</td><td>${rate}</td><td>${r.stock || 0}</td></tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <button class="btn btn-primary btn-block" id="confirmBulkImportBtn" style="margin-top:14px;">${t('import_n_products').replace('{n}', parsedRows.length)}</button>
      </div>
    `;
    document.getElementById('confirmBulkImportBtn').addEventListener('click', async (e) => {
      const btn = e.target;
      btn.disabled = true;
      btn.textContent = t('importing');
      try {
        const result = await api('/products/bulk-import', { method: 'POST', body: { products: parsedRows } });
        area.innerHTML = `
          <div class="card">
            <div style="font-size:15px; font-weight:700; color:var(--green-dark);">${t('products_added_success').replace('{n}', result.createdCount)}</div>
            ${result.skippedCount ? `<div class="muted" style="font-size:12.5px; margin-top:6px;">${t('products_skipped_note').replace('{n}', result.skippedCount)}</div>` : ''}
            <button class="btn btn-outline" id="goToProductsBtn" style="margin-top:12px;">${t('go_to_products_list')}</button>
          </div>
        `;
        document.getElementById('goToProductsBtn').addEventListener('click', () => loadAdminTab('products'));
      } catch (err) {
        toast(err.message);
        btn.disabled = false;
        btn.textContent = t('import_n_products').replace('{n}', parsedRows.length);
      }
    });
  }
}

/* ----- Admin: Bulk Image Upload (assign each image to a product via inline search) ----- */
function normalizeForMatch(str) {
  return str.toLowerCase().replace(/[_\-]+/g, ' ').replace(/\.[a-z0-9]+$/i, '').replace(/\s+/g, ' ').trim();
}
// Filenames like IMG_001, DSC0234, WhatsApp Image 2024... carry no real product info —
// skip using them as a search seed so the box starts empty instead of showing junk.
function looksLikeGenericFilename(name) {
  return /^(img|dsc|photo|picture|image|whatsapp|screenshot|20\d{2})/i.test(name.trim());
}

function renderAdminBulkImage(box) {
  let rows = []; // { file, previewUrl, product }

  box.innerHTML = `
    <div class="section-title">${t('bulkimage_title')}</div>
    <div class="muted" style="font-size:12.5px; margin-bottom:12px; white-space:pre-line;">${t('bulkimage_instructions')}</div>
    <input type="file" id="bulkImgInput" accept="image/*" multiple>
    <div id="bulkImgPreviewArea" style="margin-top:14px;"></div>
  `;

  document.getElementById('bulkImgInput').addEventListener('change', (e) => {
    const files = [...e.target.files];
    if (!files.length) return;
    rows = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      guessName: looksLikeGenericFilename(file.name) ? '' : normalizeForMatch(file.name),
      product: null,
    }));
    renderPreview();
  });

  function rowHtml(row, i) {
    return `
      <div class="pick-row" data-i="${i}" style="align-items:flex-start;">
        <img src="${row.previewUrl}" style="width:44px; height:44px; object-fit:cover; border-radius:8px; flex-shrink:0;">
        <div style="flex:1; min-width:0;">
          <div class="muted" style="font-size:10.5px; margin-bottom:3px;">${escapeHtml(row.file.name)}</div>
          ${row.product ? `
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-weight:600; font-size:13.5px;">✅ ${escapeHtml(row.product.name)}</span>
              <span class="changeMatchLink" style="text-decoration:underline; cursor:pointer; font-size:12px; color:var(--muted);">${t('bulkimage_change_link')}</span>
            </div>
          ` : `
            <input type="text" class="rowSearchInput" placeholder="${t('type_product_name')}" value="${escapeHtml(row.guessName)}" style="padding:7px 9px; font-size:13px;">
            <div class="rowSearchResults" style="margin-top:4px;"></div>
          `}
        </div>
        <button class="btn-icon-delete removeRowBtn" title="${t('discard_btn')}">🗑️</button>
      </div>
    `;
  }

  function renderPreview(focusIndex) {
    const area = document.getElementById('bulkImgPreviewArea');
    const matchedCount = rows.filter((r) => r.product).length;
    area.innerHTML = `
      <div class="card">
        <div style="margin-bottom:8px;">${t('bulkimage_total_line').replace('{a}', rows.length).replace('{b}', matchedCount)}</div>
        <div id="bulkImgList" style="max-height:420px; overflow-y:auto;">
          ${rows.map(rowHtml).join('')}
        </div>
        <button class="btn btn-primary btn-block" id="startBulkImgUpload" style="margin-top:14px;" ${matchedCount === 0 ? 'disabled' : ''}>
          ${t('upload_n_images').replace('{n}', matchedCount)}
        </button>
        <div id="bulkImgProgress" class="muted" style="font-size:12.5px; margin-top:8px;"></div>
      </div>
    `;
    wireRowSearches(focusIndex);

    document.getElementById('bulkImgList').addEventListener('click', (e) => {
      const row = e.target.closest('.pick-row');
      if (!row) return;
      const i = Number(row.dataset.i);
      if (e.target.classList.contains('removeRowBtn')) {
        rows.splice(i, 1);
        renderPreview();
      } else if (e.target.classList.contains('changeMatchLink')) {
        rows[i].product = null;
        renderPreview(i);
      }
    });

    document.getElementById('startBulkImgUpload').addEventListener('click', async () => {
      const btn = document.getElementById('startBulkImgUpload');
      const progressEl = document.getElementById('bulkImgProgress');
      btn.disabled = true;
      const toUpload = rows.filter((r) => r.product);
      let done = 0;
      let failed = 0;
      for (const row of toUpload) {
        progressEl.textContent = t('uploading_n_of').replace('{a}', done + 1).replace('{b}', toUpload.length);
        try {
          const url = await uploadImage(row.file, 'products');
          await api(`/products/${row.product._id}/stock`, { method: 'PATCH', body: { image: url } });
          done++;
        } catch (err) {
          failed++;
        }
      }
      progressEl.textContent = '';
      const area2 = document.getElementById('bulkImgPreviewArea');
      area2.innerHTML = `
        <div class="card">
          <div style="font-size:15px; font-weight:700; color:var(--green-dark);">${t('images_placed_success').replace('{n}', done - failed)}</div>
          ${failed ? `<div class="muted" style="font-size:12.5px; margin-top:6px;">${t('images_failed_note').replace('{n}', failed)}</div>` : ''}
          <button class="btn btn-outline" id="goToProductsBtn2" style="margin-top:12px;">${t('go_to_products_list')}</button>
        </div>
      `;
      document.getElementById('goToProductsBtn2').addEventListener('click', () => loadAdminTab('products'));
    });
  }

  function wireRowSearches(focusIndex) {
    document.querySelectorAll('.rowSearchInput').forEach((input) => {
      const row = input.closest('.pick-row');
      const i = Number(row.dataset.i);
      const resultsEl = row.querySelector('.rowSearchResults');
      let debounceTimer;
      let currentResults = [];

      function selectProduct(chosen) {
        rows[i].product = chosen;
        renderPreview(i + 1); // jump straight to the next image so typing/Enter can continue uninterrupted
      }

      async function runSearch(val) {
        if (!val.trim()) { resultsEl.innerHTML = ''; currentResults = []; return; }
        const alreadyAssignedIds = rows.filter((r) => r.product).map((r) => r.product._id);
        const params = new URLSearchParams({ q: val.trim(), limit: '5', noImage: 'true' });
        if (alreadyAssignedIds.length) params.set('exclude', alreadyAssignedIds.join(','));
        const res = await api(`/products/admin?${params.toString()}`);
        currentResults = res.items;
        resultsEl.innerHTML = currentResults.length
          ? currentResults.map((p, idx) => `<div class="rowResultItem${idx === 0 ? ' rowResultTop' : ''}" data-pid="${p._id}" style="padding:7px 9px; font-size:13px; border:1px solid var(--border); border-top:none; cursor:pointer;">${idx === 0 ? '↵ ' : ''}${escapeHtml(p.name)}</div>`).join('')
          : `<div class="muted" style="font-size:12px; padding:4px 2px;">${t('no_products_found_or_imaged')}</div>`;
        resultsEl.querySelectorAll('.rowResultItem').forEach((item) => {
          item.addEventListener('click', () => selectProduct(currentResults.find((p) => p._id === item.dataset.pid)));
        });
      }

      input.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => runSearch(e.target.value), 300);
      });
      // Enter picks the top (best-scoring) match instantly — no need to wait or reach for the mouse.
      input.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (currentResults.length) selectProduct(currentResults[0]);
      });
      // run once immediately in case a non-generic filename already seeded a useful guess
      if (input.value.trim()) runSearch(input.value);
    });

    if (focusIndex !== undefined) {
      const nextInput = document.querySelector(`.pick-row[data-i="${focusIndex}"] .rowSearchInput`);
      if (nextInput) { nextInput.focus(); nextInput.select(); }
    }
  }
}

/* ----- Admin: Products ----- */
let lastUsedCategory = '';
let lastUsedCompanyId = '';
let lastUsedUnit = 'পাতা';
function productRow(p) {
  const isOut = !p.inStock;
  return `
    <tr data-id="${p._id}" class="${isOut ? 'row-out-of-stock' : ''}">
      <td>${p.image ? `<img src="${cldResize(p.image, 100)}" class="thumb-sm">` : `<div class="thumb-placeholder">💊</div>`}</td>
      <td><span class="prodNameCell">${escapeHtml(p.name)}${formBadge(p)}</span></td>
      <td><span class="company-cell" title="${escapeHtml(p.companyName || '-')}">${escapeHtml(p.companyName || '-')}</span></td>
      <td>${money(p.price)}</td>
      <td><input type="number" class="stockInput" value="${p.stock}" style="width:60px; padding:5px;"></td>
      <td><span class="pill ${p.inStock ? 'pill-approved' : 'pill-blocked'}">${p.inStock ? t('in_stock') : t('out_of_stock')}</span></td>
      <td style="white-space:nowrap;">
        <button class="btn btn-sm ${isOut ? 'btn-primary' : 'btn-outline'} toggleStock" title="${isOut ? t('action_restock') : t('action_stockout')}">${isOut ? '↩️' : '🚫'}</button>
        <button class="btn btn-outline btn-sm editBtn" title="${t('action_edit')}">✏️</button>
        <button class="btn btn-outline btn-sm copyLinkBtn" title="${t('action_copy_link')}">🔗</button>
        <button class="btn-icon-delete delBtn" title="${t('action_delete')}">🗑️</button>
      </td>
    </tr>
  `;
}

/* ----- Admin: Stock Out (grouped by company) ----- */
async function renderAdminStockoutGrouped(box) {
  const groups = await api('/products/stockout-grouped');
  const knownProducts = {};
  groups.forEach((g) => g.products.forEach((p) => { knownProducts[p._id] = p; }));
  let activeCompany = null; // null = folder grid view; otherwise company name = drill-down view

  function folderCardHtml(g) {
    return `
      <div class="card stockout-folder" data-company="${escapeHtml(g.companyName)}">
        <div style="font-weight:700; font-size:15px;">🏢 ${escapeHtml(g.companyName)}</div>
        <div style="color:var(--danger); font-size:13px; margin-top:4px;">${g.count}${t('stockout_products_count')}</div>
      </div>
    `;
  }

  function renderFolders() {
    box.innerHTML = groups.length
      ? `<div class="stockout-folder-grid">${groups.map(folderCardHtml).join('')}</div>`
      : `<div class="empty-state">${t('no_stockout_products')}</div>`;
  }

  function renderCompanyDetail(companyName) {
    const g = groups.find((x) => x.companyName === companyName);
    if (!g) { activeCompany = null; renderFolders(); return; }
    box.innerHTML = `
      <button class="btn btn-outline btn-sm" id="backToFoldersBtn" style="margin-bottom:12px;">${t('back_to_all_companies')}</button>
      <div class="section-title" style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
        🏢 ${escapeHtml(g.companyName)} <span class="pill pill-blocked">${g.count}${t('stockout_products_count')}</span>
      </div>
      <div style="overflow-x:auto;">
      <table>
        <thead><tr><th>${t('th_image')}</th><th>${t('th_name')}</th><th>${t('th_company')}</th><th>${t('th_price')}</th><th>${t('th_stock')}</th><th>${t('th_status')}</th><th></th></tr></thead>
        <tbody>${g.products.map(productRow).join('')}</tbody>
      </table>
      </div>
    `;
  }

  function render() {
    if (activeCompany) renderCompanyDetail(activeCompany);
    else renderFolders();
  }

  async function refresh() {
    const fresh = await api('/products/stockout-grouped');
    groups.length = 0;
    groups.push(...fresh);
    Object.keys(knownProducts).forEach((k) => delete knownProducts[k]);
    groups.forEach((g) => g.products.forEach((p) => { knownProducts[p._id] = p; }));
    // if the company being viewed has no stock-out items left, drop back to the folder grid
    if (activeCompany && !groups.find((g) => g.companyName === activeCompany)) activeCompany = null;
    render();
  }

  function wireEvents() {
    box.addEventListener('click', async (e) => {
      const folderCard = e.target.closest('.stockout-folder');
      if (folderCard) { activeCompany = folderCard.dataset.company; render(); return; }
      if (e.target.id === 'backToFoldersBtn') { activeCompany = null; render(); return; }

      const row = e.target.closest('tr[data-id]');
      if (!row) return;
      const id = row.dataset.id;
      const product = knownProducts[id];
      if (!product) return;

      if (e.target.classList.contains('toggleStock')) {
        try {
          await api(`/products/${id}/stock`, { method: 'PATCH', body: { inStock: !product.inStock } });
          toast(t('toast_marked_restocked'));
          await refresh();
        } catch (err) { toast(err.message); }
      } else if (e.target.classList.contains('editBtn')) {
        const companies = await api('/companies');
        openProductForm(product, companies, box, refresh);
      } else if (e.target.classList.contains('copyLinkBtn')) {
        const link = `${location.origin}/#/product/${id}`;
        try {
          await navigator.clipboard.writeText(link);
          toast(t('toast_link_copied'));
        } catch (err) {
          prompt(t('prompt_copy_link'), link);
        }
      } else if (e.target.classList.contains('delBtn')) {
        if (!confirm(t('confirm_delete_product'))) return;
        try {
          await api(`/products/${id}`, { method: 'DELETE' });
          await refresh();
        } catch (err) { toast(err.message); }
      }
    });

    box.addEventListener('change', async (e) => {
      if (!e.target.classList.contains('stockInput')) return;
      const id = e.target.closest('tr[data-id]').dataset.id;
      try {
        await api(`/products/${id}/stock`, { method: 'PATCH', body: { stock: Number(e.target.value) } });
        toast('স্টক আপডেট হয়েছে');
        await refresh();
      } catch (err) { toast(err.message); }
    });
  }

  wireEvents();
  render();
}

/* ----- Admin: Products ----- */
async function renderAdminProducts(box, outOfStockOnly = false) {
  const companies = await api('/companies');
  let pageState = { items: [], page: 1, hasMore: false, loading: false, outOfStockCount: 0 };
  let currentQuery = '';

  async function fetchPage(page, q) {
    const params = new URLSearchParams({ limit: '50', page: String(page) });
    if (q) params.set('q', q);
    params.set('inStock', outOfStockOnly ? 'false' : 'true');
    return api(`/products/admin?${params.toString()}`);
  }

  async function loadFirstPage(q) {
    currentQuery = q;
    pageState = { ...pageState, loading: true };
    const res = await fetchPage(1, q);
    pageState = { items: res.items, page: 1, hasMore: res.hasMore, loading: false, outOfStockCount: res.outOfStockCount };
  }

  await loadFirstPage('');

  function emptyRow() {
    return `<tr><td colspan="7" class="empty-state">${outOfStockOnly ? t('no_stockout_products') : t('no_products')}</td></tr>`;
  }

  function renderBody() {
    box.innerHTML = `
      <button class="btn btn-primary btn-sm" id="addProductBtn" style="margin-bottom:12px;">${t('add_new_product')}</button>
      <div class="search-bar"><input type="text" id="productSearchInput" placeholder="${t('product_search_placeholder')}" value="${escapeHtml(currentQuery)}"></div>
      ${!outOfStockOnly && pageState.outOfStockCount ? `
        <div class="muted" style="font-size:12.5px; margin:10px 0; cursor:pointer;" id="goToStockoutLine">
          ${t('stockout_moved_note_pre')} <b>"${t('admin_stockout')}"</b> ${t('stockout_moved_note_post')}
          <span class="pill pill-blocked">${pageState.outOfStockCount}</span> ${t('stockout_moved_note_view')}
        </div>
      ` : ''}
      <div style="overflow-x:auto;">
      <table>
        <thead><tr><th>${t('th_image')}</th><th>${t('th_name')}</th><th>${t('th_company')}</th><th>${t('th_price')}</th><th>${t('th_stock')}</th><th>${t('th_status')}</th><th></th></tr></thead>
        <tbody id="productTableBody">${pageState.items.length ? pageState.items.map(productRow).join('') : emptyRow()}</tbody>
      </table>
      </div>
      <div id="loadMoreArea" style="text-align:center; margin-top:14px;">
        ${pageState.hasMore ? `<button class="btn btn-outline" id="loadMoreBtn">${t('load_more')}</button>` : ''}
      </div>
    `;
    wireEvents();
  }

  function wireEvents() {
    document.getElementById('addProductBtn').addEventListener('click', () => openProductForm(null, companies, box));
    const goToStockoutLine = document.getElementById('goToStockoutLine');
    if (goToStockoutLine) goToStockoutLine.addEventListener('click', () => loadAdminTab('stockout'));

    let searchDebounce;
    document.getElementById('productSearchInput').addEventListener('input', (e) => {
      const val = e.target.value;
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(async () => {
        await loadFirstPage(val);
        renderBody();
        const input = document.getElementById('productSearchInput');
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }, 300);
    });

    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', async () => {
        if (pageState.loading) return;
        pageState.loading = true;
        loadMoreBtn.textContent = t('loading');
        const next = await fetchPage(pageState.page + 1, currentQuery);
        pageState.items = pageState.items.concat(next.items);
        pageState.page += 1;
        pageState.hasMore = next.hasMore;
        pageState.loading = false;
        document.getElementById('productTableBody').innerHTML = pageState.items.map(productRow).join('');
        document.getElementById('loadMoreArea').innerHTML = pageState.hasMore ? `<button class="btn btn-outline" id="loadMoreBtn2">${t('load_more')}</button>` : '';
        const newBtn = document.getElementById('loadMoreBtn2');
        if (newBtn) newBtn.addEventListener('click', () => document.getElementById('loadMoreBtn')?.click());
      });
    }

    const tbody = document.getElementById('productTableBody');
    if (!tbody) return;

    tbody.addEventListener('change', async (e) => {
      if (!e.target.classList.contains('stockInput')) return;
      const row = e.target.closest('tr');
      const id = row.dataset.id;
      try {
        const updated = await api(`/products/${id}/stock`, { method: 'PATCH', body: { stock: Number(e.target.value) } });
        const product = pageState.items.find((p) => p._id === id);
        if (product) { product.stock = updated.stock; product.inStock = updated.inStock; }
        const belongsHere = outOfStockOnly ? !updated.inStock : updated.inStock;
        if (belongsHere) {
          row.outerHTML = productRow(product);
        } else {
          pageState.items = pageState.items.filter((p) => p._id !== id);
          row.remove();
          toast(updated.inStock ? t('toast_back_in_stock') : t('toast_moved_to_stockout'));
          if (!pageState.items.length) document.getElementById('productTableBody').innerHTML = emptyRow();
          return;
        }
        toast(t('toast_stock_updated'));
      } catch (err) { toast(err.message); }
    });

    tbody.addEventListener('click', async (e) => {
      const row = e.target.closest('tr[data-id]');
      if (!row) return;
      const id = row.dataset.id;
      const product = pageState.items.find((p) => p._id === id);
      if (!product) return;

      if (e.target.classList.contains('toggleStock')) {
        try {
          await api(`/products/${id}/stock`, { method: 'PATCH', body: { inStock: !product.inStock } });
          toast(product.inStock ? t('toast_marked_stockout') : t('toast_marked_restocked'));
          await loadFirstPage(currentQuery);
          renderBody();
        } catch (err) { toast(err.message); }
      } else if (e.target.classList.contains('editBtn')) {
        openProductForm(product, companies, box);
      } else if (e.target.classList.contains('copyLinkBtn')) {
        const link = `${location.origin}/#/product/${id}`;
        try {
          await navigator.clipboard.writeText(link);
          toast(t('toast_link_copied'));
        } catch (err) {
          prompt(t('prompt_copy_link'), link);
        }
      } else if (e.target.classList.contains('delBtn')) {
        if (!confirm(t('confirm_delete_product'))) return;
        try {
          await api(`/products/${id}`, { method: 'DELETE' });
          await loadFirstPage(currentQuery);
          renderBody();
        } catch (err) { toast(err.message); }
      }
    });
  }

  renderBody();
}

function openProductForm(product, companies, box, onDone) {
  const done = onDone || (() => renderAdminProducts(box));
  const isEdit = !!product;
  const formHtml = `
    <div class="card" style="border:1.5px solid #0d9488;" id="productFormCard">
      <div class="section-title">${isEdit ? 'প্রোডাক্ট সম্পাদনা' : 'নতুন প্রোডাক্ট'}</div>
      ${!isEdit ? `<div class="muted" style="font-size:12px; margin-top:-8px; margin-bottom:6px;">একটার পর একটা সেভ করলে ফর্মটা খোলাই থাকবে, বারবার খুলতে হবে না। শেষ হলে "বাতিল" চাপুন।</div>` : ''}
      <label>নাম</label><input id="f_name" value="${isEdit ? escapeHtml(product.name) : ''}">
      <label>কোম্পানি</label>
      <select id="f_company">
        <option value="">-- নির্বাচন করুন --</option>
        ${companies.map((c) => `<option value="${c._id}" ${(isEdit ? product.company === c._id : lastUsedCompanyId === c._id) ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
      </select>
      <label>ক্যাটাগরি</label><input id="f_category" value="${isEdit ? escapeHtml(product.category) : escapeHtml(lastUsedCategory)}">
      <label>ইউনিট (যেমন: পাতা, পিস, বক্স)</label><input id="f_unit" value="${isEdit ? escapeHtml(product.unit) : escapeHtml(lastUsedUnit)}">
      <label>ফর্ম (কাস্টমারকে নামের পাশে ছোট ব্যাজে দেখানো হবে)</label>
      <select id="f_form">
        <option value="">-- নির্বাচন করুন (না দিলে নাম দেখে অনুমান হবে) --</option>
        ${Object.keys(FORM_LABELS).map((k) => `<option value="${k}" ${isEdit && product.form === k ? 'selected' : ''}>${FORM_LABELS[k].icon} ${k}</option>`).join('')}
      </select>
      <label>এমআরপি (MRP)</label><input id="f_mrp" type="number" value="${isEdit ? product.mrp : ''}">
      <label>পাইকারি ছাড় (%)</label><input id="f_discount" type="number" placeholder="যেমন: 20" value="${isEdit && product.mrp > 0 ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : ''}">
      <label>পাইকারি মূল্য (স্বয়ংক্রিয়, চাইলে বদলাতে পারবেন)</label><input id="f_price" type="number" value="${isEdit ? product.price : ''}">
      <label>স্টক</label><input id="f_stock" type="number" value="${isEdit ? product.stock : 0}">
      <label>প্রোডাক্টের ছবি</label>
      ${isEdit && product.image ? `<img src="${product.image}" class="img-preview" id="f_imagePreview">` : ''}
      <input type="file" id="f_imageFile" accept="image/*">
      <div style="display:flex; gap:8px; margin-top:14px;">
        <button class="btn btn-primary" id="saveProductBtn">${isEdit ? 'সংরক্ষণ করুন' : 'সংরক্ষণ করে আরেকটি যোগ করুন'}</button>
        <button class="btn btn-outline" id="cancelProductBtn">${isEdit ? 'বাতিল' : 'শেষ করুন'}</button>
      </div>
    </div>
  `;
  box.insertAdjacentHTML('afterbegin', formHtml);

  document.getElementById('f_imageFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let img = document.getElementById('f_imagePreview');
      if (!img) {
        img = document.createElement('img');
        img.id = 'f_imagePreview';
        img.className = 'img-preview';
        document.getElementById('f_imageFile').insertAdjacentElement('beforebegin', img);
      }
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  function recalcPrice() {
    const mrp = Number(document.getElementById('f_mrp').value) || 0;
    const discount = Number(document.getElementById('f_discount').value) || 0;
    if (mrp > 0 && discount > 0) {
      const price = Math.round(mrp - (mrp * discount) / 100);
      document.getElementById('f_price').value = price;
    }
  }
  document.getElementById('f_mrp').addEventListener('input', recalcPrice);
  document.getElementById('f_discount').addEventListener('input', recalcPrice);

  document.getElementById('cancelProductBtn').addEventListener('click', () => done());
  document.getElementById('saveProductBtn').addEventListener('click', async () => {
    const companyEl = document.getElementById('f_company');
    const payload = {
      name: document.getElementById('f_name').value,
      company: companyEl.value || undefined,
      companyName: companyEl.selectedOptions[0]?.textContent || '',
      category: document.getElementById('f_category').value,
      unit: document.getElementById('f_unit').value,
      form: document.getElementById('f_form').value,
      mrp: Number(document.getElementById('f_mrp').value),
      price: Number(document.getElementById('f_price').value),
      stock: Number(document.getElementById('f_stock').value),
    };
    if (isEdit && product.image) payload.image = product.image;

    const saveBtn = document.getElementById('saveProductBtn');
    saveBtn.disabled = true;
    try {
      const file = document.getElementById('f_imageFile').files[0];
      if (file) {
        saveBtn.textContent = 'ছবি আপলোড হচ্ছে...';
        payload.image = await uploadImage(file, 'products');
      }
      saveBtn.textContent = 'সংরক্ষণ হচ্ছে...';
      if (isEdit) await api(`/products/${product._id}`, { method: 'PUT', body: payload });
      else await api('/products', { method: 'POST', body: payload });
      lastUsedCategory = payload.category || '';
      lastUsedCompanyId = companyEl.value || '';
      lastUsedUnit = payload.unit || lastUsedUnit;

      if (isEdit) {
        toast('সংরক্ষণ হয়েছে');
        done();
      } else {
        toast('✅ প্রোডাক্ট যোগ হয়েছে — পরেরটা লিখুন');
        // Keep the form open for fast back-to-back entry: clear only the
        // per-product fields, keep company/category/unit as they were.
        document.getElementById('f_name').value = '';
        document.getElementById('f_mrp').value = '';
        document.getElementById('f_discount').value = '';
        document.getElementById('f_price').value = '';
        document.getElementById('f_stock').value = 0;
        document.getElementById('f_form').value = '';
        document.getElementById('f_imageFile').value = '';
        const preview = document.getElementById('f_imagePreview');
        if (preview) preview.remove();
        saveBtn.disabled = false;
        saveBtn.textContent = 'সংরক্ষণ করে আরেকটি যোগ করুন';
        document.getElementById('f_name').focus();
      }
    } catch (err) {
      toast(err.message);
      saveBtn.disabled = false;
      saveBtn.textContent = isEdit ? 'সংরক্ষণ করুন' : 'সংরক্ষণ করে আরেকটি যোগ করুন';
    }
  });
}

/* ----- Admin: Orders ----- */
async function renderAdminOrders(box) {
  const allOrders = await api('/orders');
  const statusLabel = {
    pending: t('status_pending'), confirmed: t('status_confirmed'), processing: t('status_processing'),
    shipped: t('status_shipped'), delivered: t('status_delivered'), cancelled: t('status_cancelled'),
  };
  let showCancelled = false;
  const cancelledCount = allOrders.filter((o) => o.status === 'cancelled').length;

  function orderCard(o) {
    return `
      <div class="order-card" data-id="${o._id}">
        <div class="oc-head">
          <b>${o.orderNo}</b>
          <span class="status-badge status-${o.status}">${statusLabel[o.status]}</span>
        </div>
        <div class="muted" style="font-size:12.5px;">
          ${o.customer?.pharmacyName || ''} • ${o.customer?.phone || ''}
          ${o.createdByAdmin ? `<span class="pill pill-approved" style="margin-left:6px;">${t('admin_order_badge')}</span>` : ''}
        </div>
        <div style="font-size:13px; margin:6px 0;">${o.items.map((it) => `${escapeHtml(it.name)} × ${it.qty}`).join(', ')}</div>
        <div class="row-between">
          <b>${money(o.total)}</b>
          <select class="statusSelect">
            ${Object.keys(statusLabel).map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${statusLabel[s]}</option>`).join('')}
          </select>
        </div>
        <a href="#/invoice/${o._id}" class="btn btn-outline btn-sm btn-block" style="margin-top:10px;">${t('print_invoice')}</a>
        <a href="#/edit-order/${o._id}" class="btn btn-primary btn-sm btn-block" style="margin-top:8px;">${t('edit_order_btn')}</a>
      </div>
    `;
  }

  function currentList() {
    return showCancelled ? allOrders : allOrders.filter((o) => o.status !== 'cancelled');
  }

  box.innerHTML = `
    <label style="display:flex; align-items:center; gap:8px; font-weight:600; font-size:13.5px; margin-bottom:12px;">
      <input type="checkbox" id="showCancelledFilter" style="width:auto;">
      ${t('show_cancelled_orders')} ${cancelledCount ? `<span class="pill pill-blocked" style="margin-left:4px;">${cancelledCount}${t('cancelled_count_suffix')}</span>` : ''}
    </label>
    <div id="orderListBody">
      ${renderOrderGroups(currentList())}
    </div>
  `;

  function wireCardEvents() {
    document.querySelectorAll('.order-card').forEach((card) => {
      const id = card.dataset.id;
      card.querySelector('.statusSelect').addEventListener('change', async (e) => {
        try {
          await api(`/orders/${id}/status`, { method: 'PATCH', body: { status: e.target.value } });
          toast(t('toast_order_status_updated'));
          renderAdminOrders(box);
        } catch (err) { toast(err.message); }
      });
    });
  }
  wireCardEvents();

  document.getElementById('showCancelledFilter').addEventListener('change', (e) => {
    showCancelled = e.target.checked;
    document.getElementById('orderListBody').innerHTML = renderOrderGroups(currentList());
    wireCardEvents();
  });

  function renderOrderGroups(list) {
    if (list.length === 0) return `<div class="empty-state">${t('no_orders_found')}</div>`;
    return groupOrdersByDay(list).map((g, i) => `
      <details class="day-folder" ${i === 0 ? 'open' : ''}>
        <summary class="day-folder-label">
          <span>📁 ${g.label} <span class="day-folder-count">${g.orders.length}${t('orders_count_suffix')}</span></span>
        </summary>
        <div class="day-folder-body">
          ${g.orders.map(orderCard).join('')}
        </div>
      </details>
    `).join('');
  }
}

/* ----- Admin: New Order (on behalf of a customer) ----- */
async function renderAdminNewOrder(box) {
  const [customers, initialProducts] = await Promise.all([
    api('/customers?status=approved'),
    api('/products?limit=30'),
  ]);

  let selectedCustomer = null;
  const cart = {}; // productId -> qty
  const knownProducts = {}; // productId -> product (accumulates everything ever shown in search results)
  initialProducts.items.forEach((p) => { knownProducts[p._id] = p; });
  let currentProductResults = initialProducts.items;

  function customerRow(c) {
    return `
      <div class="pick-row clickable" data-id="${c._id}">
        <div>
          <div style="font-weight:600;">${escapeHtml(c.pharmacyName)}</div>
          <div class="muted" style="font-size:12.5px;">${escapeHtml(c.ownerName)} • 📞 ${escapeHtml(c.phone)}${c.area ? ' • ' + escapeHtml(c.area) : ''}</div>
        </div>
      </div>
    `;
  }

  function productRow(p) {
    const inCart = cart[p._id] || 0;
    return `
      <div class="pick-row" data-id="${p._id}">
        <div>
          <div style="font-weight:600;">${escapeHtml(p.name)}</div>
          <div class="muted" style="font-size:12.5px;">${escapeHtml(p.companyName || '')} • ${money(p.price)} • ${t('stock_short')} ${p.stock}</div>
        </div>
        <button class="btn btn-primary btn-sm addProdBtn" ${p.stock <= inCart ? 'disabled' : ''}>${t('add_short')}</button>
      </div>
    `;
  }

  box.innerHTML = `
    <div class="section-title">${t('neworder_title')}</div>
    <div class="card">
      <label>${t('neworder_step1')}</label>
      <div id="custPickArea">
        <input type="text" id="custSearchInput" placeholder="${t('cust_search_placeholder')}">
        <div id="custPickList" style="max-height:280px; overflow-y:auto; margin-top:8px;">
          ${customers.length ? customers.map(customerRow).join('') : `<div class="empty-state">${t('no_approved_customers')}</div>`}
        </div>
      </div>
      <div id="custSelectedArea" style="display:none;"></div>
    </div>
    <div id="orderBuildArea"></div>
  `;

  function wireCustPickClicks() {
    document.querySelectorAll('#custPickList .pick-row').forEach((row) => {
      row.addEventListener('click', () => {
        selectedCustomer = customers.find((c) => c._id === row.dataset.id);
        showSelectedCustomer();
      });
    });
  }

  document.getElementById('custSearchInput').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    const filtered = customers.filter((c) =>
      c.pharmacyName.toLowerCase().includes(q) || c.ownerName.toLowerCase().includes(q) || c.phone.includes(q)
    );
    document.getElementById('custPickList').innerHTML = filtered.length
      ? filtered.map(customerRow).join('')
      : `<div class="empty-state">${t('no_customers_found')}</div>`;
    wireCustPickClicks();
  });
  wireCustPickClicks();

  function showSelectedCustomer() {
    document.getElementById('custPickArea').style.display = 'none';
    const area = document.getElementById('custSelectedArea');
    area.style.display = 'block';
    area.innerHTML = `
      <div class="row-between" style="background:#f0fdfa; border:1.5px solid #0d9488; border-radius:10px; padding:10px 12px;">
        <div>
          <div style="font-weight:700;">${escapeHtml(selectedCustomer.pharmacyName)}</div>
          <div class="muted" style="font-size:12.5px;">${escapeHtml(selectedCustomer.ownerName)} • 📞 ${escapeHtml(selectedCustomer.phone)}</div>
        </div>
        <button class="btn btn-outline btn-sm" id="changeCustBtn">${t('change_btn')}</button>
      </div>
    `;
    document.getElementById('changeCustBtn').addEventListener('click', () => {
      selectedCustomer = null;
      Object.keys(cart).forEach((k) => delete cart[k]);
      area.style.display = 'none';
      document.getElementById('custPickArea').style.display = 'block';
      renderOrderBuild();
    });
    renderOrderBuild();
  }

  function wireProdPickClicks() {
    document.querySelectorAll('#prodPickList .addProdBtn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.closest('.pick-row').dataset.id;
        const product = knownProducts[id];
        const cur = cart[id] || 0;
        if (cur >= product.stock) { toast(t('stock_limit')); return; }
        cart[id] = cur + 1;
        renderOrderBuild();
      });
    });
  }

  function renderOrderBuild() {
    const buildArea = document.getElementById('orderBuildArea');
    if (!selectedCustomer) { buildArea.innerHTML = ''; return; }

    const items = Object.keys(cart)
      .map((id) => ({ product: knownProducts[id], qty: cart[id] }))
      .filter((x) => x.product);
    const total = items.reduce((s, x) => s + x.product.price * x.qty, 0);

    buildArea.innerHTML = `
      <div class="card">
        <label>${t('neworder_step2')}</label>
        <input type="text" id="prodSearchInput" placeholder="${t('prod_search_placeholder')}">
        <div id="prodPickList" style="max-height:260px; overflow-y:auto; margin-top:8px;">
          ${currentProductResults.map(productRow).join('')}
        </div>
      </div>
      <div class="card" id="cartCard">
        ${items.length === 0 ? `<div class="empty-state">${t('empty_cart')}</div>` : `
          ${items.map((x) => `
            <div class="cart-item" data-id="${x.product._id}">
              <div>
                <div class="ci-name">${escapeHtml(x.product.name)}</div>
                <div class="ci-sub">${money(x.product.price)} × ${x.qty} = ${money(x.product.price * x.qty)}</div>
              </div>
              <div class="qty-row">
                <button class="dec">−</button>
                <span class="qty-val">${x.qty}</span>
                <button class="inc">+</button>
              </div>
            </div>
          `).join('')}
          <div class="summary-row total" style="border-top:1px dashed #d8dcda; margin-top:8px; padding-top:8px;">
            <span>${t('total')}</span><span>${money(total)}</span>
          </div>
        `}
      </div>
      ${items.length > 0 ? `
        <div class="card">
          <label>${t('delivery_address')}</label>
          <textarea id="adminOrderAddress" rows="2">${escapeHtml(selectedCustomer.address || '')}</textarea>
          <label>${t('note_optional')}</label>
          <textarea id="adminOrderNote" rows="2" placeholder="${t('note_placeholder')}"></textarea>
          <button class="btn btn-primary btn-block" id="submitAdminOrderBtn" style="margin-top:14px;">${t('create_order_btn')}</button>
        </div>
      ` : ''}
    `;

    let prodSearchDebounce;
    document.getElementById('prodSearchInput').addEventListener('input', (e) => {
      const q = e.target.value.trim();
      clearTimeout(prodSearchDebounce);
      prodSearchDebounce = setTimeout(async () => {
        const res = q
          ? await api(`/products?q=${encodeURIComponent(q)}&limit=30`, { auth: false })
          : { items: initialProducts.items };
        res.items.forEach((p) => { knownProducts[p._id] = p; });
        currentProductResults = res.items;
        const list = document.getElementById('prodPickList');
        if (!list) return; // user may have moved on (e.g. changed customer) before this resolved
        list.innerHTML = currentProductResults.length
          ? currentProductResults.map(productRow).join('')
          : `<div class="empty-state">${t('no_products')}</div>`;
        wireProdPickClicks();
        const input = document.getElementById('prodSearchInput');
        if (input) { input.focus(); input.setSelectionRange(q.length, q.length); }
      }, 300);
    });
    wireProdPickClicks();

    const cartCard = document.getElementById('cartCard');
    cartCard.addEventListener('click', (e) => {
      const item = e.target.closest('.cart-item');
      if (!item) return;
      const id = item.dataset.id;
      const product = knownProducts[id];
      const cur = cart[id] || 0;
      if (e.target.classList.contains('inc')) {
        if (cur >= product.stock) { toast(t('stock_limit')); return; }
        cart[id] = cur + 1;
      }
      if (e.target.classList.contains('dec')) {
        const next = cur - 1;
        if (next <= 0) delete cart[id]; else cart[id] = next;
      }
      renderOrderBuild();
    });

    const submitBtn = document.getElementById('submitAdminOrderBtn');
    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        submitBtn.disabled = true;
        submitBtn.textContent = t('creating');
        try {
          const payload = {
            customerId: selectedCustomer._id,
            items: items.map((x) => ({ productId: x.product._id, qty: x.qty })),
            note: document.getElementById('adminOrderNote').value,
            deliveryAddress: document.getElementById('adminOrderAddress').value,
          };
          const order = await api('/orders/admin-create', { method: 'POST', body: payload });
          toast(`✅ ${t('toast_order_created')} ${order.orderNo}`);
          loadAdminTab('orders');
        } catch (err) {
          toast(err.message);
          submitBtn.disabled = false;
          submitBtn.textContent = t('create_order_btn');
        }
      });
    }
  }
}

/* ----- Admin: Customers ----- */
/* ----- Admin: Admins (add/remove other admin accounts) ----- */
async function renderAdminAdmins(box) {
  const admins = await api('/admins');
  box.innerHTML = `
    <div class="card" style="border:1.5px solid var(--green);">
      <div class="section-title" style="font-size:14px; margin-top:0;">${t('add_new_admin_title')}</div>
      <label>${t('label_name')}</label>
      <input id="na_name" placeholder="${t('name_placeholder')}">
      <label>${t('phone')}</label>
      <input id="na_phone" placeholder="${t('phone_placeholder')}">
      <label>${t('password')}</label>
      <div class="pwd-wrap"><input id="na_pass" type="password"><button type="button" class="pwd-toggle" data-target="na_pass" tabindex="-1">👁️</button></div>
      <button class="btn btn-primary btn-block" id="addAdminBtn" style="margin-top:12px;">${t('add_admin_btn')}</button>
    </div>
    <div class="section-title" style="font-size:14px;">${t('all_admins_count')} (${admins.length})</div>
    <div style="overflow-x:auto;">
    <table>
      <thead><tr><th>${t('label_name')}</th><th>${t('th_phone')}</th><th>${t('th_joined')}</th><th></th></tr></thead>
      <tbody id="adminTableBody">
        ${admins.map((a) => `
          <tr data-id="${a._id}">
            <td>${escapeHtml(a.name)}</td>
            <td>${escapeHtml(a.phone)}</td>
            <td>${new Date(a.createdAt).toLocaleDateString(state.lang === 'en' ? 'en-US' : 'bn-BD')}</td>
            <td>${a._id === state.admin?.id ? `<span class="muted" style="font-size:12px;">${t('you_label')}</span>` : `<button class="btn-icon-delete delAdminBtn" title="${t('action_delete_generic')}">🗑️</button>`}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    </div>
  `;
  wirePasswordToggles(box);

  document.getElementById('addAdminBtn').addEventListener('click', async () => {
    const name = document.getElementById('na_name').value.trim();
    const phone = document.getElementById('na_phone').value.trim();
    const password = document.getElementById('na_pass').value;
    if (!name || !phone || !password) { toast(t('toast_fill_all_fields')); return; }
    const btn = document.getElementById('addAdminBtn');
    btn.disabled = true;
    btn.textContent = t('adding');
    try {
      await api('/admins', { method: 'POST', body: { name, phone, password } });
      toast(t('toast_admin_added'));
      renderAdminAdmins(box);
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
      btn.textContent = t('add_admin_btn');
    }
  });

  document.getElementById('adminTableBody').addEventListener('click', async (e) => {
    const btn = e.target.closest('.delAdminBtn');
    if (!btn) return;
    const id = btn.closest('tr').dataset.id;
    if (!confirm(t('confirm_delete_admin'))) return;
    try {
      await api(`/admins/${id}`, { method: 'DELETE' });
      toast(t('toast_admin_deleted'));
      renderAdminAdmins(box);
    } catch (err) { toast(err.message); }
  });
}

async function renderAdminCustomers(box) {
  const customers = await api('/customers');
  const label = { pending: t('cust_status_label_pending'), approved: t('cust_status_label_approved'), blocked: t('cust_status_label_blocked') };
  box.innerHTML = `
    <div style="overflow-x:auto;">
    <table>
      <thead><tr><th>${t('th_pharmacy')}</th><th>${t('th_owner')}</th><th>${t('th_phone')}</th><th>${t('th_status')}</th><th></th></tr></thead>
      <tbody id="customerTableBody">
        ${customers.map((c) => `
          <tr data-id="${c._id}">
            <td>${escapeHtml(c.pharmacyName)}</td>
            <td>${escapeHtml(c.ownerName)}</td>
            <td>${escapeHtml(c.phone)}</td>
            <td><span class="pill pill-${c.status}">${label[c.status]}</span></td>
            <td style="white-space:nowrap;">
              <button class="btn btn-outline btn-sm editCustomerBtn">${t('action_edit_short')}</button>
              ${c.status !== 'approved' ? `<button class="btn btn-primary btn-sm approveBtn">${t('action_approve')}</button>` : ''}
              ${c.status !== 'blocked' ? `<button class="btn btn-danger btn-sm blockBtn">${t('action_block')}</button>` : `<button class="btn btn-outline btn-sm unblockBtn">${t('action_unblock')}</button>`}
              <button class="btn-icon-delete delCustomerBtn" title="${t('action_delete_customer')}">🗑️</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    </div>
  `;
  document.getElementById('customerTableBody').addEventListener('click', async (e) => {
    const row = e.target.closest('tr[data-id]');
    if (!row) return;
    const id = row.dataset.id;
    const setStatus = async (status) => {
      try {
        await api(`/customers/${id}/status`, { method: 'PATCH', body: { status } });
        renderAdminCustomers(box);
      } catch (err) { toast(err.message); }
    };
    if (e.target.classList.contains('editCustomerBtn')) {
      openCustomerEditForm(customers.find((c) => c._id === id), box);
    }
    else if (e.target.classList.contains('approveBtn')) setStatus('approved');
    else if (e.target.classList.contains('blockBtn')) setStatus('blocked');
    else if (e.target.classList.contains('unblockBtn')) setStatus('approved');
    else if (e.target.classList.contains('delCustomerBtn')) {
      if (!confirm(t('confirm_delete_customer'))) return;
      try {
        await api(`/customers/${id}`, { method: 'DELETE' });
        toast(t('toast_customer_deleted'));
        renderAdminCustomers(box);
      } catch (err) { toast(err.message); }
    }
  });
}

function openCustomerEditForm(customer, box) {
  const existing = document.getElementById('customerEditFormCard');
  if (existing) existing.remove();

  const formHtml = `
    <div class="card" style="border:1.5px solid #0d9488;" id="customerEditFormCard">
      <div class="section-title">${t('edit_customer_title')}</div>
      <label>${t('label_pharmacy_name')}</label><input id="ce_pharmacyName" value="${escapeHtml(customer.pharmacyName)}">
      <label>${t('label_owner_name')}</label><input id="ce_ownerName" value="${escapeHtml(customer.ownerName)}">
      <label>${t('label_phone_number')}</label><input id="ce_phone" value="${escapeHtml(customer.phone)}">
      <label>${t('label_address')}</label><textarea id="ce_address" rows="2">${escapeHtml(customer.address || '')}</textarea>
      <label>${t('label_area')}</label><input id="ce_area" value="${escapeHtml(customer.area || '')}">
      <label>${t('label_trade_license')}</label><input id="ce_tradeLicense" value="${escapeHtml(customer.tradeLicense || '')}">
      <label>${t('label_status')}</label>
      <select id="ce_status">
        <option value="pending" ${customer.status === 'pending' ? 'selected' : ''}>${t('cust_status_label_pending')}</option>
        <option value="approved" ${customer.status === 'approved' ? 'selected' : ''}>${t('cust_status_label_approved')}</option>
        <option value="blocked" ${customer.status === 'blocked' ? 'selected' : ''}>${t('cust_status_label_blocked')}</option>
      </select>
      <label>${t('label_new_password_optional')}</label>
      <input type="password" id="ce_password" placeholder="${t('placeholder_new_password')}">
      <div style="display:flex; gap:8px; margin-top:14px;">
        <button class="btn btn-primary" id="saveCustomerEditBtn">${t('save')}</button>
        <button class="btn btn-outline" id="cancelCustomerEditBtn">${t('cancel')}</button>
      </div>
    </div>
  `;
  box.insertAdjacentHTML('afterbegin', formHtml);

  document.getElementById('cancelCustomerEditBtn').addEventListener('click', () => {
    document.getElementById('customerEditFormCard').remove();
  });
  document.getElementById('saveCustomerEditBtn').addEventListener('click', async (e) => {
    const btn = e.target;
    const payload = {
      pharmacyName: document.getElementById('ce_pharmacyName').value.trim(),
      ownerName: document.getElementById('ce_ownerName').value.trim(),
      phone: document.getElementById('ce_phone').value.trim(),
      address: document.getElementById('ce_address').value.trim(),
      area: document.getElementById('ce_area').value.trim(),
      tradeLicense: document.getElementById('ce_tradeLicense').value.trim(),
      status: document.getElementById('ce_status').value,
    };
    const newPass = document.getElementById('ce_password').value;
    if (newPass) payload.password = newPass;

    btn.disabled = true;
    btn.textContent = t('saving');
    try {
      await api(`/customers/${customer._id}`, { method: 'PUT', body: payload });
      toast(t('toast_customer_updated'));
      renderAdminCustomers(box);
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
      btn.textContent = t('save');
    }
  });
}

/* ----- Admin: Companies ----- */
function companyRow(c) {
  return `
    <tr data-id="${c._id}">
      <td>${c.logo ? `<img src="${c.logo}" class="thumb-sm">` : `<div class="thumb-placeholder">🏢</div>`}</td>
      <td>${escapeHtml(c.name)}</td>
      <td><button class="btn-icon-delete delCompanyBtn" title="${t('action_delete_generic')}">🗑️</button></td>
    </tr>
  `;
}

async function renderAdminCompanies(box) {
  const companies = await api('/companies');
  box.innerHTML = `
    <div class="card" style="border:1.5px solid #0d9488;">
      <label>${t('new_company_name')}</label>
      <input id="newCompanyName" placeholder="${t('company_name_placeholder')}">
      <label>${t('company_logo_optional')}</label>
      <input type="file" id="newCompanyLogo" accept="image/*">
      <button class="btn btn-primary btn-sm" id="addCompanyBtn" style="margin-top:10px;">${t('add_btn')}</button>
    </div>
    <div class="search-bar"><input type="text" id="companySearchInput" placeholder="${t('company_search_placeholder')}"></div>
    <div style="overflow-x:auto;">
    <table>
      <thead><tr><th>${t('th_logo')}</th><th>${t('th_name')}</th><th></th></tr></thead>
      <tbody id="companyTableBody">${companies.map(companyRow).join('')}</tbody>
    </table>
    </div>
  `;

  document.getElementById('companySearchInput').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    const filtered = companies.filter((c) => c.name.toLowerCase().includes(q));
    document.getElementById('companyTableBody').innerHTML = filtered.length
      ? filtered.map(companyRow).join('')
      : `<tr><td colspan="3" class="empty-state">${t('no_companies_found')}</td></tr>`;
  });

  document.getElementById('addCompanyBtn').addEventListener('click', async () => {
    const name = document.getElementById('newCompanyName').value.trim();
    if (!name) { toast(t('toast_enter_company_name')); return; }
    const btn = document.getElementById('addCompanyBtn');
    btn.disabled = true;
    try {
      let logo = '';
      const file = document.getElementById('newCompanyLogo').files[0];
      if (file) {
        btn.textContent = t('uploading_image');
        logo = await uploadImage(file, 'companies');
      }
      await api('/companies', { method: 'POST', body: { name, logo } });
      renderAdminCompanies(box);
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
      btn.textContent = t('add_btn');
    }
  });

  document.getElementById('companyTableBody').addEventListener('click', async (e) => {
    const btn = e.target.closest('.delCompanyBtn');
    if (!btn) return;
    const id = btn.closest('tr').dataset.id;
    if (!confirm(t('confirm_delete_generic'))) return;
    try {
      await api(`/companies/${id}`, { method: 'DELETE' });
      renderAdminCompanies(box);
    } catch (err) { toast(err.message); }
  });
}

/* ----- Admin: Announcements ----- */
async function renderAdminAnnouncements(box) {
  const list = await api('/announcements/admin');
  box.innerHTML = `
    <div class="card" style="border:1.5px solid #0d9488;">
      <label>${t('label_title')}</label><input id="an_title">
      <label>${t('label_message')}</label><textarea id="an_message" rows="2"></textarea>
      <button class="btn btn-primary btn-sm" id="addAnnounceBtn" style="margin-top:10px;">${t('add_btn')}</button>
    </div>
    ${list.map((a) => `
      <div class="card" data-id="${a._id}">
        <div class="row-between">
          <b>${escapeHtml(a.title)}</b>
          <span class="pill ${a.active ? 'pill-approved' : 'pill-blocked'} toggleActive" style="cursor:pointer;">${a.active ? t('status_active') : t('status_inactive')}</span>
        </div>
        <div class="muted" style="font-size:13px; margin:4px 0;">${escapeHtml(a.message)}</div>
        <button class="btn btn-danger btn-sm delAnnounceBtn">${t('action_delete_with_icon')}</button>
      </div>
    `).join('')}
  `;
  document.getElementById('addAnnounceBtn').addEventListener('click', async () => {
    try {
      await api('/announcements', {
        method: 'POST',
        body: { title: document.getElementById('an_title').value, message: document.getElementById('an_message').value },
      });
      renderAdminAnnouncements(box);
    } catch (err) { toast(err.message); }
  });
  box.querySelectorAll('[data-id]').forEach((card) => {
    const id = card.dataset.id;
    card.querySelector('.toggleActive')?.addEventListener('click', async () => {
      const active = card.querySelector('.toggleActive').textContent.trim() === t('status_active');
      try {
        await api(`/announcements/${id}`, { method: 'PUT', body: { active: !active } });
        renderAdminAnnouncements(box);
      } catch (err) { toast(err.message); }
    });
    card.querySelector('.delAnnounceBtn')?.addEventListener('click', async () => {
      if (!confirm(t('confirm_delete_generic'))) return;
      try {
        await api(`/announcements/${id}`, { method: 'DELETE' });
        renderAdminAnnouncements(box);
      } catch (err) { toast(err.message); }
    });
  });
}

/* ----- Admin: ল্যান্ডিং পেজ (public/home/landing.html কনটেন্ট ম্যানেজমেন্ট) ----- */
async function renderAdminLanding(box) {
  const s = await api('/settings', { auth: false });
  const features = s.landingFeatures || [];
  const whyList = s.landingWhyChooseUs || [];
  const landingBanners = s.landingBanners || [];
  const MAX_BANNERS = 5;

  box.innerHTML = `
    <div class="card" style="border:1.5px solid var(--green);">
      <div class="muted" style="font-size:12.5px; margin-bottom:6px;">
        ${t('landing_note')}
      </div>
      <label>${t('label_tagline')}</label>
      <input id="ld_tagline" value="${escapeHtml(s.landingTagline || '')}">
      <label>${t('label_about_us')}</label>
      <textarea id="ld_about" rows="3">${escapeHtml(s.landingAbout || '')}</textarea>
      <label>${t('label_contact_address')}</label>
      <textarea id="ld_address" rows="2">${escapeHtml(s.landingContactAddress || '')}</textarea>
      <label>${t('label_contact_email')}</label>
      <input id="ld_email" value="${escapeHtml(s.landingContactEmail || '')}">
      <button class="btn btn-primary btn-block" id="saveLandingBtn" style="margin-top:14px;">${t('save_btn')}</button>
    </div>

    <div class="section-title">${t('landing_banners_title').replace('{n}', MAX_BANNERS)}</div>
    <div id="landingBannerList">
      ${landingBanners.map((b) => `
        <div class="card" data-bid="${b._id}">
          <img src="${cldResize(b.url, 500)}" style="width:100%; border-radius:10px; margin-bottom:8px;">
          <label style="margin-top:0;">${t('label_button_link_optional')}</label>
          <input type="text" class="ldBannerLinkInput" placeholder="${t('link_placeholder')}" value="${escapeHtml(b.link || '')}">
          <label>${t('label_button_text_optional')}</label>
          <input type="text" class="ldBannerTextInput" placeholder="${t('button_text_placeholder')}" value="${escapeHtml(b.buttonText || '')}">
          <div class="row-between" style="margin-top:8px;">
            <span class="pill ${b.active ? 'pill-approved' : 'pill-blocked'} toggleLdBannerActive" style="cursor:pointer;">${b.active ? t('status_active') : t('status_inactive')}</span>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-outline btn-sm saveLdBannerLinkBtn">${t('save_link_btn')}</button>
              <button class="btn-icon-delete delLdBannerBtn" title="${t('action_delete_generic')}">🗑️</button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
    <div class="card">
      ${landingBanners.length >= MAX_BANNERS
        ? `<div class="muted" style="font-size:13px;">${t('banners_max_reached').replace('{n}', MAX_BANNERS)}</div>`
        : `<label>${t('add_new_slider_banner').replace('{a}', landingBanners.length).replace('{b}', MAX_BANNERS)}</label>
           <input type="file" id="ldBannerFile" accept="image/*">
           <label>${t('label_button_link')}</label>
           <input type="text" id="ldBannerLinkNew" placeholder="${t('link_placeholder')}">
           <label>${t('label_button_text_optional')}</label>
           <input type="text" id="ldBannerTextNew" placeholder="${t('button_text_placeholder')}">
           <button class="btn btn-outline btn-sm" id="uploadLdBannerBtn" style="margin-top:8px;">${t('upload_banner_btn')}</button>`
      }
    </div>

    <div class="section-title">${t('features_title')}</div>
    <div class="card">
      <label>${t('label_icon_emoji')}</label><input id="ft_icon" placeholder="🚚" style="max-width:90px;">
      <label>${t('label_title_generic')}</label><input id="ft_title" placeholder="${t('title_placeholder_delivery')}">
      <label>${t('label_description')}</label><textarea id="ft_desc" rows="2" placeholder="${t('desc_placeholder_delivery')}"></textarea>
      <button class="btn btn-outline btn-sm" id="addFeatureBtn" style="margin-top:10px;">${t('add_feature_btn')}</button>
    </div>
    <div id="featureList">
      ${features.map((f, i) => `
        <div class="card" data-idx="${i}">
          <div class="row-between">
            <b>${escapeHtml(f.icon || '💊')} ${escapeHtml(f.title || '')}</b>
            <button class="btn-icon-delete delFeatureBtn" title="${t('action_delete_generic')}">🗑️</button>
          </div>
          <div class="muted" style="font-size:13px; margin-top:4px;">${escapeHtml(f.desc || '')}</div>
        </div>
      `).join('')}
    </div>

    <div class="section-title">${t('why_choose_us_title')}</div>
    <div class="card">
      <label>${t('label_one_point')}</label>
      <input id="why_text" placeholder="${t('why_point_placeholder')}">
      <button class="btn btn-outline btn-sm" id="addWhyBtn" style="margin-top:10px;">${t('add_point_btn')}</button>
    </div>
    <div id="whyList">
      ${whyList.map((w, i) => `
        <div class="card row-between" data-idx="${i}">
          <span>✅ ${escapeHtml(w)}</span>
          <button class="btn-icon-delete delWhyBtn" title="${t('action_delete_generic')}">🗑️</button>
        </div>
      `).join('')}
    </div>
  `;

  document.getElementById('saveLandingBtn').addEventListener('click', async () => {
    try {
      await api('/settings', {
        method: 'PUT',
        body: {
          landingTagline: document.getElementById('ld_tagline').value,
          landingAbout: document.getElementById('ld_about').value,
          landingContactAddress: document.getElementById('ld_address').value,
          landingContactEmail: document.getElementById('ld_email').value,
        },
      });
      toast(t('toast_landing_saved'));
    } catch (err) { toast(err.message); }
  });

  const uploadLdBannerBtn = document.getElementById('uploadLdBannerBtn');
  if (uploadLdBannerBtn) {
    uploadLdBannerBtn.addEventListener('click', async () => {
      const file = document.getElementById('ldBannerFile').files[0];
      if (!file) { toast(t('toast_select_image')); return; }
      try {
        toast(t('uploading_ellipsis'));
        const url = await uploadImage(file, 'landing-banners');
        const link = document.getElementById('ldBannerLinkNew').value.trim();
        const buttonText = document.getElementById('ldBannerTextNew').value.trim();
        const updated = [...landingBanners, { url, active: true, link, buttonText }];
        await api('/settings', { method: 'PUT', body: { landingBanners: updated } });
        toast(t('toast_banner_added'));
        renderAdminLanding(box);
      } catch (err) { toast(err.message); }
    });
  }
  document.getElementById('landingBannerList').querySelectorAll('[data-bid]').forEach((card) => {
    const bid = card.dataset.bid;
    card.querySelector('.toggleLdBannerActive').addEventListener('click', async () => {
      const updated = landingBanners.map((b) => (b._id === bid ? { ...b, active: !b.active } : b));
      try {
        await api('/settings', { method: 'PUT', body: { landingBanners: updated } });
        renderAdminLanding(box);
      } catch (err) { toast(err.message); }
    });
    card.querySelector('.saveLdBannerLinkBtn').addEventListener('click', async () => {
      const link = card.querySelector('.ldBannerLinkInput').value.trim();
      const buttonText = card.querySelector('.ldBannerTextInput').value.trim();
      const updated = landingBanners.map((b) => (b._id === bid ? { ...b, link, buttonText } : b));
      try {
        await api('/settings', { method: 'PUT', body: { landingBanners: updated } });
        toast(t('toast_link_saved'));
        renderAdminLanding(box);
      } catch (err) { toast(err.message); }
    });
    card.querySelector('.delLdBannerBtn').addEventListener('click', async () => {
      if (!confirm(t('confirm_delete_banner'))) return;
      const updated = landingBanners.filter((b) => b._id !== bid);
      try {
        await api('/settings', { method: 'PUT', body: { landingBanners: updated } });
        renderAdminLanding(box);
      } catch (err) { toast(err.message); }
    });
  });

  document.getElementById('addFeatureBtn').addEventListener('click', async () => {
    const title = document.getElementById('ft_title').value.trim();
    if (!title) { toast(t('toast_enter_feature_title')); return; }
    const newFeatures = [...features, {
      icon: document.getElementById('ft_icon').value.trim() || '💊',
      title,
      desc: document.getElementById('ft_desc').value.trim(),
    }];
    try {
      await api('/settings', { method: 'PUT', body: { landingFeatures: newFeatures } });
      renderAdminLanding(box);
    } catch (err) { toast(err.message); }
  });
  document.getElementById('featureList').addEventListener('click', async (e) => {
    const btn = e.target.closest('.delFeatureBtn');
    if (!btn) return;
    const idx = Number(btn.closest('[data-idx]').dataset.idx);
    const newFeatures = features.filter((_, i) => i !== idx);
    try {
      await api('/settings', { method: 'PUT', body: { landingFeatures: newFeatures } });
      renderAdminLanding(box);
    } catch (err) { toast(err.message); }
  });

  document.getElementById('addWhyBtn').addEventListener('click', async () => {
    const text = document.getElementById('why_text').value.trim();
    if (!text) return;
    const newWhy = [...whyList, text];
    try {
      await api('/settings', { method: 'PUT', body: { landingWhyChooseUs: newWhy } });
      renderAdminLanding(box);
    } catch (err) { toast(err.message); }
  });
  document.getElementById('whyList').addEventListener('click', async (e) => {
    const btn = e.target.closest('.delWhyBtn');
    if (!btn) return;
    const idx = Number(btn.closest('[data-idx]').dataset.idx);
    const newWhy = whyList.filter((_, i) => i !== idx);
    try {
      await api('/settings', { method: 'PUT', body: { landingWhyChooseUs: newWhy } });
      renderAdminLanding(box);
    } catch (err) { toast(err.message); }
  });
}

/* ----- Admin: Settings (app on/off, logo, banners, shop info) ----- */
async function renderAdminSettings(box) {
  const s = await api('/settings', { auth: false });

  box.innerHTML = `
    <div class="card" style="border:1.5px solid var(--green);">
      <div class="row-between">
        <div>
          <b>অ্যাপ চালু/বন্ধ</b>
          <div class="muted" style="font-size:12.5px;">আপনি বন্ধ করলে কোনো কাস্টমার নতুন অর্ডার করতে পারবে না।</div>
        </div>
        <label class="theme-switch">
          <input type="checkbox" id="s_appEnabled" ${s.appEnabled !== false ? 'checked' : ''}>
          <span class="switch-slider"></span>
        </label>
      </div>
    </div>

    <div class="card">
      <div class="section-title" style="margin-top:0;">অ্যাপ লোগো</div>
      <div class="muted" style="font-size:12.5px; margin-bottom:8px;">এটাই যে লোগো দেখবেন সেটা মোবাইল অ্যাপের হোম স্ক্রিনে দেখাবে।</div>
      ${s.logoUrl ? `<img src="${s.logoUrl}" style="width:64px; height:64px; border-radius:12px; object-fit:cover; margin-bottom:8px;">` : ''}
      <input type="file" id="logoFile" accept="image/*">
      <button class="btn btn-outline btn-sm" id="uploadLogoBtn" style="margin-top:8px;">লোগো আপলোড করুন</button>
    </div>

    <div class="card" style="background:var(--green-light); border:none;">
      <div class="muted" style="font-size:12.5px;">💡 হোম পেজের স্লাইডার ব্যানার এখন <b>"ল্যান্ডিং পেজ"</b> ট্যাব থেকে ম্যানেজ করা হয় — একটাই জায়গা, বিভ্রান্তি এড়াতে।</div>
    </div>

    <div class="card">
      <div class="section-title" style="margin-top:0;">দোকানের তথ্য</div>
      <label>দোকানের নাম</label><input id="s_shopName" value="${escapeHtml(s.shopName)}">
      <label>হেডলাইন</label><input id="s_heroTitle" value="${escapeHtml(s.heroTitle)}">
      <label>সাবটাইটেল</label><textarea id="s_heroSubtitle" rows="2">${escapeHtml(s.heroSubtitle)}</textarea>
      <label>হটলাইন নম্বর</label><input id="s_hotline" value="${escapeHtml(s.hotline || '')}">
      <label>সর্বনিম্ন অর্ডার মূল্য (৳)</label>
      <input id="s_minOrder" type="number" min="0" value="${s.minOrderAmount || 500}">
      <button class="btn btn-primary btn-block" id="saveSettingsBtn" style="margin-top:14px;">সংরক্ষণ করুন</button>
    </div>
  `;

  document.getElementById('s_appEnabled').addEventListener('change', async (e) => {
    try {
      await api('/settings', { method: 'PUT', body: { appEnabled: e.target.checked } });
      toast(e.target.checked ? 'অ্যাপ চালু করা হয়েছে' : 'অ্যাপ বন্ধ করা হয়েছে');
    } catch (err) { toast(err.message); }
  });

  document.getElementById('uploadLogoBtn').addEventListener('click', async () => {
    const file = document.getElementById('logoFile').files[0];
    if (!file) { toast('ছবি সিলেক্ট করুন'); return; }
    try {
      toast('আপলোড হচ্ছে...');
      const url = await uploadImage(file, 'logo');
      await api('/settings', { method: 'PUT', body: { logoUrl: url } });
      toast('লোগো আপডেট হয়েছে');
      renderAdminSettings(box);
    } catch (err) { toast(err.message); }
  });

  document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    try {
      await api('/settings', {
        method: 'PUT',
        body: {
          shopName: document.getElementById('s_shopName').value,
          heroTitle: document.getElementById('s_heroTitle').value,
          heroSubtitle: document.getElementById('s_heroSubtitle').value,
          hotline: document.getElementById('s_hotline').value,
          minOrderAmount: Number(document.getElementById('s_minOrder').value) || 500,
        },
      });
      toast('সেটিংস সংরক্ষণ হয়েছে');
    } catch (err) { toast(err.message); }
  });
}

/* ---------- Splash / welcome screen (once per browser session) ---------- */
function initSplash() {
  const splash = document.getElementById('splashScreen');
  if (!splash) return;
  if (sessionStorage.getItem('og_splash_shown')) {
    splash.remove();
    return;
  }
  sessionStorage.setItem('og_splash_shown', '1');
  setTimeout(() => {
    splash.classList.add('hide');
    setTimeout(() => splash.remove(), 550);
  }, 1300);
}

/* ================= INIT ================= */
initSplash();
applyStaticTranslations();
updateCartBadge();
router();
