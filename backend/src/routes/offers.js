const router = require('express').Router();
const Product = require('../models/Product');
const Variant = require('../models/Variant');
const Merchant = require('../models/Merchant');
const MerchantOffer = require('../models/MerchantOffer');
const ApiError = require('../utils/ApiError');
const S = require('../utils/schemas');
const { urlMatchesDomain } = require('../utils/helpers');
const { validate, validId } = require('../middleware/validate');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { applyOfferChange, appendHistory, refreshVariant } = require('../services/catalog');

const admin = [authenticate, requireAdmin];

router.get('/merchants', async (req, res) => res.json({ merchants: await Merchant.find().sort({ name: 1 }) }));
router.post('/merchants', ...admin, validate(S.merchantCreate), async (req, res) => {
  res.status(201).json({ merchant: await Merchant.create(req.valid.body) });
});



router.post('/products/:id/offers', ...admin, validId('id'), validate(S.offerCreate), async (req, res) => {
  const b = req.valid.body;
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  const variant = await Variant.findOne({ _id: b.variantId, productId: product._id });
  if (!variant) throw new ApiError(400, 'Variant does not belong to this product');
  const merchant = await Merchant.findById(b.merchantId);
  if (!merchant) throw new ApiError(400, 'Unknown merchant');
  if (!urlMatchesDomain(b.url, merchant.domain)) throw new ApiError(400, `URL must be on ${merchant.domain}`);

  let offer;
  try {
    offer = await MerchantOffer.create({ ...b, shipping: b.shipping ?? null, productId: product._id });
  } catch (e) {
    if (e.code === 11000) throw new ApiError(409, 'This merchant already has an offer for this variant. Update it instead.');
    throw e;
  }
  await appendHistory(offer, offer.lastUpdatedAt); 
  await refreshVariant(offer.variantId);
  res.status(201).json({ offer });
});

router.put('/offers/:id', ...admin, validId('id'), validate(S.offerUpdate), async (req, res) => {
  const offer = await MerchantOffer.findById(req.params.id);
  if (!offer) throw new ApiError(404, 'Offer not found');
  const changes = req.valid.body;
  if (changes.url) {
    const m = await Merchant.findById(offer.merchantId);
    if (!urlMatchesDomain(changes.url, m.domain)) throw new ApiError(400, `URL must be on ${m.domain}`);
  }
  await applyOfferChange(offer, changes);
  res.json({ offer });
});



router.post('/offers/:id/price-history', ...admin, validId('id'), validate(S.historyCreate), async (req, res) => {
  const offer = await MerchantOffer.findById(req.params.id);
  if (!offer) throw new ApiError(404, 'Offer not found');
  const b = req.valid.body;
  const when = b.recordedAt || new Date();
  if (when.getTime() > Date.now() + 60000) throw new ApiError(400, 'recordedAt cannot be in the future');

  if (when >= offer.lastUpdatedAt) {
    const changes = { price: b.price };
    if (b.shipping !== undefined) changes.shipping = b.shipping;
    if (b.availability) changes.availability = b.availability;
    await applyOfferChange(offer, changes, when);
    return res.status(201).json({ offer, appliedAsCurrent: true });
  }
  const backfill = { ...offer.toObject(), price: b.price, shipping: b.shipping === undefined ? offer.shipping : b.shipping, availability: b.availability || offer.availability };
  await appendHistory(backfill, when);
  res.status(201).json({ offer, appliedAsCurrent: false });
});

module.exports = router;
