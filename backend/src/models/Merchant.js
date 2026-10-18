const { Schema, model } = require('mongoose');
const merchantSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    // Offer URLs must belong to this domain (e.g. "amazon.in")
    domain: { type: String, required: true, lowercase: true, trim: true },
  },
  { timestamps: true }
);
module.exports = model('Merchant', merchantSchema);
