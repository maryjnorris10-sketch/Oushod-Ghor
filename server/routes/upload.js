const express = require('express');
const multer = require('multer');
const streamifier = require('streamifier');
const cloudinary = require('../config/cloudinary');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// keep the uploaded file in memory, then stream it to Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('শুধু ছবি ফাইল আপলোড করা যাবে'));
    }
    cb(null, true);
  },
});

function uploadBufferToCloudinary(buffer, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `oushod-ghor/${folder}`, resource_type: 'image' },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

// POST /api/upload  (admin only) -> body: multipart/form-data, field name "image"
// optional query: ?folder=logo | banners | products
router.post('/', adminAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'কোনো ছবি পাওয়া যায়নি' });
    const folder = req.query.folder || 'misc';
    const result = await uploadBufferToCloudinary(req.file.buffer, folder);
    res.json({ url: result.secure_url });
  } catch (err) {
    res.status(500).json({ message: 'আপলোড ব্যর্থ', error: err.message });
  }
});

module.exports = router;
