const { Schema, model } = require('mongoose');
const merchantSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    domain: { type: String, required: true, lowercase: true, trim: true },
  },
  { timestamps: true }
);
module.exports = model('Merchant', merchantSchema);
