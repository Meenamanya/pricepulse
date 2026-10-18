const { Schema, model } = require('mongoose');
// Append-only: the app never updates or deletes these documents.
const historySchema = new Schema({
  offerId: { type: Schema.Types.ObjectId, ref: 'MerchantOffer', required: true },
  variantId: { type: Schema.Types.ObjectId, ref: 'Variant', required: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true },
  price: { type: Number, required: true, min: 0 },
  shipping: { type: Number, default: null },
  availability: { type: String, enum: ['in_stock', 'out_of_stock'], default: 'in_stock' },
  recordedAt: { type: Date, default: Date.now },
  isSimulated: { type: Boolean, default: true },
});
historySchema.index({ offerId: 1, recordedAt: 1 });
historySchema.index({ variantId: 1, recordedAt: 1 });
module.exports = model('PriceHistory', historySchema);
