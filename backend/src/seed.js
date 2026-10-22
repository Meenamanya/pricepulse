require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Product = require('./models/Product');
const Variant = require('./models/Variant');
const Merchant = require('./models/Merchant');
const MerchantOffer = require('./models/MerchantOffer');
const PriceHistory = require('./models/PriceHistory');
const Watchlist = require('./models/Watchlist');
const PriceAlert = require('./models/PriceAlert');
const { buildSku } = require('./utils/helpers');
const { refreshVariant } = require('./services/catalog');

const MERCHANTS = {
  amazon: { name: 'Amazon India', domain: 'amazon.in', url: (q) => `https://www.amazon.in/s?k=${q}` },
  flipkart: { name: 'Flipkart', domain: 'flipkart.com', url: (q) => `https://www.flipkart.com/search?q=${q}` },
  croma: { name: 'Croma', domain: 'croma.com', url: (q) => `https://www.croma.com/searchB?q=${q}` },
  reliance: { name: 'Reliance Digital', domain: 'reliancedigital.in', url: (q) => `https://www.reliancedigital.in/search?q=${q}` },
};

const CATALOG = [
  { brand: 'Samsung', model: 'Galaxy S24 FE', category: 'smartphones', variants: [
    { a: { ram: '8GB', storage: '256GB', color: 'Blue' }, offers: { amazon: [28499, 500], flipkart: [29000, 0], croma: [28800, null] } }, // brief's scenario
    { a: { ram: '8GB', storage: '128GB', color: 'Blue' }, offers: { amazon: [25999, 0], flipkart: [26499, 0], reliance: [26200, 99, 'out_of_stock'] } },
  ] },
  { brand: 'Apple', model: 'iPhone 15', category: 'smartphones', variants: [
    { a: { storage: '128GB', color: 'Black' }, offers: { amazon: [61900, 0], flipkart: [62999, 0], croma: [62490, 0], reliance: [63500, 150] } },
    { a: { storage: '256GB', color: 'Black' }, offers: { amazon: [71900, 0], croma: [72490, null] } },
  ] },
  { brand: 'OnePlus', model: 'Nord CE4', category: 'smartphones', variants: [
    { a: { ram: '8GB', storage: '128GB', color: 'Dark Chrome' }, offers: { amazon: [22999, 0], flipkart: [23499, 0] } },
  ] },
  { brand: 'Lenovo', model: 'IdeaPad Slim 3', category: 'laptops', variants: [
    { a: { ram: '16GB', storage: '512GB', color: 'Arctic Grey' }, offers: { amazon: [46990, 0], flipkart: [47490, 0], croma: [48999, 0] } },
  ] },
  { brand: 'HP', model: 'Pavilion 14', category: 'laptops', variants: [
    { a: { ram: '16GB', storage: '1TB', color: 'Silver' }, offers: { amazon: [62990, 0], reliance: [64490, 0], croma: [63990, null] } },
  ] },
  { brand: 'Sony', model: 'WH-1000XM5', category: 'headphones', variants: [
    { a: { color: 'Black' }, offers: { amazon: [26990, 0], flipkart: [27490, 0], croma: [28990, 0], reliance: [27990, 0] } },
    { a: { color: 'Silver' }, offers: { amazon: [27490, 0], flipkart: [27990, 99] } },
  ] },
  { brand: 'boAt', model: 'Rockerz 450', category: 'headphones', variants: [
    { a: { color: 'Luscious Black' }, offers: { amazon: [1299, 0], flipkart: [1199, 49] } },
  ] },
  { brand: 'Apple', model: 'Watch SE (2nd Gen)', category: 'smartwatches', variants: [
    { a: { storage: '40mm', color: 'Midnight' }, offers: { amazon: [24900, 0], croma: [25490, 0], flipkart: [24999, 0] } },
  ] },
  { brand: 'Noise', model: 'ColorFit Pro 5', category: 'smartwatches', variants: [
    { a: { color: 'Jet Black' }, offers: { amazon: [3999, 0], flipkart: [3799, 0] } },
  ] },
  { brand: 'LG', model: '8kg Front Load Washer FHM1408', category: 'home-appliances', variants: [
    { a: { color: 'Silver' }, offers: { croma: [35990, 0], reliance: [36490, 500], amazon: [34990, 1000] } },
  ] },
  { brand: 'Philips', model: 'Air Fryer HD9252', category: 'home-appliances', variants: [
    { a: { color: 'Black' }, offers: { amazon: [7299, 0], flipkart: [7499, 0] } },
  ] },
  { brand: 'Amazon', model: 'Echo Dot 5th Gen', category: 'consumer-electronics', variants: [
    { a: { color: 'Charcoal' }, offers: { amazon: [4499, 0], flipkart: [4799, 0], croma: [4999, 0] } },
  ] },
];

// deterministic pseudo-random so the seed is reproducible
function rng(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  await Promise.all([User, Product, Variant, Merchant, MerchantOffer, PriceHistory, Watchlist, PriceAlert].map((m) => m.deleteMany({})));

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@pricepulse.dev';
  const userEmail = process.env.SEED_USER_EMAIL || 'demo@pricepulse.dev';
  const admin = await User.create({ name: 'Admin', email: adminEmail, role: 'admin', passwordHash: await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'Admin@12345', 12) });
  const demo = await User.create({ name: 'Demo User', email: userEmail, role: 'user', passwordHash: await bcrypt.hash(process.env.SEED_USER_PASSWORD || 'User@12345', 12) });

  const merchants = {};
  for (const [k, m] of Object.entries(MERCHANTS)) merchants[k] = await Merchant.create({ name: m.name, domain: m.domain });

  const DAY = 86400000, now = Date.now();
  let seq = 0, offerCount = 0, histCount = 0;
  const refs = {};
  for (const [i, item] of CATALOG.entries()) {
    const name = `${item.brand} ${item.model}`;
    const product = await Product.create({
      name, brand: item.brand, model: item.model, category: item.category,
      description: `Sample listing for ${name}. All prices are simulated demo data.`,
      imageUrl: `https://placehold.co/400x400/png?text=${encodeURIComponent(item.brand)}`,
      createdAt: new Date(now - (CATALOG.length - i) * DAY), // spread creation dates so "newest" sort is meaningful
    });
    for (const v of item.variants) {
      const variant = await Variant.create({
        productId: product._id, sku: buildSku(item.brand, item.model, v.a), attributes: v.a,
        label: Object.values(v.a).join(' / '),
      });
      refs[variant.sku] = { product, variant };
      for (const [mk, [price, shipping, avail]] of Object.entries(v.offers)) {
        const q = encodeURIComponent(name);
        const offer = await MerchantOffer.create({
          productId: product._id, variantId: variant._id, merchantId: merchants[mk]._id,
          price, shipping, availability: avail || 'in_stock', url: MERCHANTS[mk].url(q), isSimulated: true,
          lastUpdatedAt: new Date(now),
        });
        offerCount++;
        // 8 weekly historical points (+/- ~8%), then the current record
        const rand = rng(++seq * 7919);
        const rows = [];
        for (let w = 8; w >= 1; w--) {
          const p = Math.round(price * (1 + (rand() - 0.4) * 0.16));
          rows.push({ offerId: offer._id, variantId: variant._id, productId: product._id, merchantId: offer._doc.merchantId, price: p, shipping, availability: 'in_stock', recordedAt: new Date(now - w * 7 * DAY), isSimulated: true });
        }
        rows.push({ offerId: offer._id, variantId: variant._id, productId: product._id, merchantId: offer._doc.merchantId, price, shipping, availability: offer.availability, recordedAt: new Date(now), isSimulated: true });
        await PriceHistory.insertMany(rows);
        histCount += rows.length;
      }
      await refreshVariant(variant._id);
    }
  }

  // Demo watchlist + alert (target below the current price, so status starts as "active")
  const s24 = refs[buildSku('Samsung', 'Galaxy S24 FE', { ram: '8GB', storage: '256GB', color: 'Blue' })];
  await Watchlist.create({ userId: demo._id, productId: s24.product._id });
  await Watchlist.create({ userId: demo._id, productId: refs[buildSku('Sony', 'WH-1000XM5', { color: 'Black' })].product._id });
  const v = await Variant.findById(s24.variant._id);
  await PriceAlert.create({ userId: demo._id, productId: s24.product._id, variantId: v._id, targetPrice: 28500, status: 'active', currentPrice: v.lowestTotal, lastEvaluatedAt: new Date() });

  console.log(`Seeded: ${CATALOG.length} products, ${offerCount} offers, ${histCount} history records`);
  console.log(`Admin: ${adminEmail} | Demo user: ${userEmail} (passwords from env or defaults in README)`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
