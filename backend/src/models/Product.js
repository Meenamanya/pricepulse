const { Schema, model } = require('mongoose');
const CATEGORIES = ['smartphones', 'laptops', 'headphones', 'smartwatches', 'home-appliances', 'consumer-electronics'];
const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    brand: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    category: { type: String, enum: CATEGORIES, required: true },
    description: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    // Denormalised for server-side price filter/sort. Maintained by services/catalog.js
    startingPrice: { type: Number, default: null },
    hasPrice: { type: Boolean, default: false },
    availableOfferCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);
productSchema.index({ brand: 1, model: 1 }, { unique: true });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ hasPrice: -1, startingPrice: 1 });
module.exports = model('Product', productSchema);
module.exports.CATEGORIES = CATEGORIES;
