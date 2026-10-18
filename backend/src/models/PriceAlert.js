const { Schema, model } = require('mongoose');
const alertSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, ref: 'Variant', required: true },
    targetPrice: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['active', 'reached'], default: 'active' },
    currentPrice: { type: Number, default: null },
    triggeredAt: { type: Date, default: null },
    lastEvaluatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
// one alert per user per variant (update it instead of duplicating)
alertSchema.index({ userId: 1, variantId: 1 }, { unique: true });
alertSchema.index({ variantId: 1 });
module.exports = model('PriceAlert', alertSchema);
