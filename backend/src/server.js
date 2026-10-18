require('dotenv').config();
const mongoose = require('mongoose');

for (const k of ['MONGODB_URI', 'JWT_SECRET']) {
  if (!process.env[k]) { console.error(`Missing required env var: ${k}`); process.exit(1); }
}
if (process.env.JWT_SECRET.length < 32) { console.error('JWT_SECRET must be at least 32 characters'); process.exit(1); }

const app = require('./app');
const port = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => app.listen(port, () => console.log(`PricePulse API listening on :${port}`)))
  .catch((e) => { console.error('MongoDB connection failed:', e.message); process.exit(1); });
