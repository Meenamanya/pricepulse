const { Schema, model } = require('mongoose');
const variantSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    sku: { type: String, required: true, unique: true },
    label: { type: String, default: '' },
    attributes: { ram: String, storage: String, color: String, region: String },
    isActive: { type: Boolean, default: true },
    
    lowestTotal: { type: Number, default: null },
    availableOfferCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);
module.exports = model('Variant', variantSchema);
