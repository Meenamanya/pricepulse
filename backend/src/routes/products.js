const router = require('express').Router();
const Product = require('../models/Product');
const Variant = require('../models/Variant');
const PriceHistory = require('../models/PriceHistory');
const ApiError = require('../utils/ApiError');
const S = require('../utils/schemas');
const { escapeRegex, buildSku } = require('../utils/helpers');
const { validate, validId } = require('../middleware/validate');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { loadOffers } = require('../services/catalog');
const { compareOffers, summarizeHistory, DATA_DISCLAIMER } = require('../services/pricing');

const SORTS = {
  price_asc: { hasPrice: -1, startingPrice: 1, _id: 1 }, 
  price_desc: { hasPrice: -1, startingPrice: -1, _id: 1 },
  newest: { createdAt: -1, _id: 1 },
};


router.get('/meta/filters', async (req, res) => {
  const brands = await Product.distinct('brand', { isActive: true });
  res.json({ categories: Product.CATEGORIES, brands: brands.sort() });
});


router.get('/', validate(S.productQuery, 'query'), async (req, res) => {
  const { q, category, brand, minPrice, maxPrice, sort, page, limit } = req.valid.query;
  const f = { isActive: true };
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    f.$or = [{ name: rx }, { brand: rx }, { model: rx }];
  }
  if (category) f.category = category;
  if (brand) f.brand = new RegExp(`^${escapeRegex(brand)}$`, 'i');
  if (minPrice !== undefined || maxPrice !== undefined) {
    f.startingPrice = {};
    if (minPrice !== undefined) f.startingPrice.$gte = minPrice;
    if (maxPrice !== undefined) f.startingPrice.$lte = maxPrice;
  }
  const [data, total] = await Promise.all([
    Product.find(f).sort(SORTS[sort]).skip((page - 1) * limit).limit(limit).lean(),
    Product.countDocuments(f),
  ]);
  res.json({ data, page, limit, total, totalPages: Math.ceil(total / limit), disclaimer: DATA_DISCLAIMER });
});

async function activeProduct(id) {
  const p = await Product.findOne({ _id: id, isActive: true });
  if (!p) throw new ApiError(404, 'Product not found');
  return p;
}
async function pickVariant(product, variantId) {
  const v = variantId
    ? await Variant.findOne({ _id: variantId, productId: product._id, isActive: true })
    : await Variant.findOne({ productId: product._id, isActive: true }).sort({ createdAt: 1 });
  if (!v) throw new ApiError(404, 'Variant not found for this product');
  return v;
}

router.get('/:id', validId('id'), async (req, res) => {
  const product = await activeProduct(req.params.id);
  const variants = await Variant.find({ productId: product._id, isActive: true }).sort({ createdAt: 1 });
  res.json({ product, variants });
});


router.get('/:id/compare', validId('id'), validate(S.compareQuery, 'query'), async (req, res) => {
  const product = await activeProduct(req.params.id);
  const variant = await pickVariant(product, req.valid.query.variantId);
  const variants = await Variant.find({ productId: product._id, isActive: true }).sort({ createdAt: 1 });
  const result = compareOffers(await loadOffers(variant._id));
  res.json({ product, variant, variants, ...result });
});

router.get('/:id/offers', validId('id'), validate(S.compareQuery, 'query'), async (req, res) => {
  const product = await activeProduct(req.params.id);
  const variant = await pickVariant(product, req.valid.query.variantId);
  const result = compareOffers(await loadOffers(variant._id));
  res.json({ variantId: variant._id, offers: result.offers });
});


router.get('/:id/price-history', validId('id'), validate(S.historyQuery, 'query'), async (req, res) => {
  const product = await activeProduct(req.params.id);
  const { offerId, variantId } = req.valid.query;
  const filter = { productId: product._id };
  if (offerId) filter.offerId = offerId;
  else filter.variantId = (await pickVariant(product, variantId))._id;

  const records = await PriceHistory.find(filter).sort({ recordedAt: 1 }).populate('merchantId', 'name').lean();
  const groups = new Map();
  for (const r of records) {
    const key = String(r.offerId);
    if (!groups.has(key)) groups.set(key, { offerId: r.offerId, merchant: r.merchantId?.name, records: [] });
    groups.get(key).records.push({
      price: r.price, shipping: r.shipping,
      total: r.shipping === null || r.shipping === undefined ? null : Math.round((r.price + r.shipping) * 100) / 100,
      availability: r.availability, recordedAt: r.recordedAt,
    });
  }
  const series = [...groups.values()].map((g) => ({ ...g, summary: summarizeHistory(g.records) }));
  res.json({ series, disclaimer: DATA_DISCLAIMER });
});


router.post('/', authenticate, requireAdmin, validate(S.productCreate), async (req, res) => {
  const { variants, ...data } = req.valid.body;
  const skus = variants.map((v) => buildSku(data.brand, data.model, v.attributes));
  if (new Set(skus).size !== skus.length) throw new ApiError(400, 'Duplicate variants in request');
  const product = await Product.create(data);
  try {
    await Variant.insertMany(variants.map((v, i) => ({ productId: product._id, sku: skus[i], label: v.label || '', attributes: v.attributes })));
  } catch (e) {
    await Product.deleteOne({ _id: product._id }); 
    throw e;
  }
  res.status(201).json({ product, variants: await Variant.find({ productId: product._id }) });
});

router.put('/:id', authenticate, requireAdmin, validId('id'), validate(S.productUpdate), async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.valid.body, { new: true, runValidators: true });
  if (!product) throw new ApiError(404, 'Product not found');
  res.json({ product });
});

router.post('/:id/variants', authenticate, requireAdmin, validId('id'), validate(S.variantCreate), async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  const { attributes, label } = req.valid.body;
  const variant = await Variant.create({ productId: product._id, sku: buildSku(product.brand, product.model, attributes), label: label || '', attributes });
  res.status(201).json({ variant });
});

module.exports = router;
