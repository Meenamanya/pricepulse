const { Schema, model } = require('mongoose');
const offerSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    variantId: { type: Schema.Types.ObjectId, ref: 'Variant', required: true },
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true },
    price: { type: Number, required: true, min: 0 },
    // null = unknown. NEVER default this to 0.
    shipping: { type: Number, default: null, min: 0 },
    availability: { type: String, enum: ['in_stock', 'out_of_stock'], default: 'in_stock' },
    url: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    isSimulated: { type: Boolean, default: true },
    lastUpdatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
// One offer per merchant per variant -> prevents duplicates
offerSchema.index({ variantId: 1, merchantId: 1 }, { unique: true });
module.exports = model('MerchantOffer', offerSchema);
