const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true }, // server-verified unit price at order time
    mrp: { type: Number, default: 0 }, // MRP snapshot at order time, for showing discount on invoice
    category: { type: String, default: '' }, // category snapshot at order time, shown on invoice
    form: { type: String, default: '' }, // ট্যাবলেট/ক্যাপসুল/সিরাপ ইত্যাদি snapshot at order time, shown on invoice
    qty: { type: Number, required: true, min: 1 },
    unit: { type: String, default: 'পিস' },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNo: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    items: { type: [orderItemSchema], required: true },
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },
    note: { type: String, default: '' },
    deliveryAddress: { type: String, default: '' },
    // true when an admin placed this order on the customer's behalf
    // (e.g. customer called in without access to their phone/app)
    createdByAdmin: { type: Boolean, default: false },
    statusHistory: [
      {
        status: String,
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

orderSchema.index({ createdAt: -1 });
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ status: 1 });

module.exports = mongoose.model('Order', orderSchema);
