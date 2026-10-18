const Product = require('../models/Product');
const Variant = require('../models/Variant');
const MerchantOffer = require('../models/MerchantOffer');
const PriceHistory = require('../models/PriceHistory');
const PriceAlert = require('../models/PriceAlert');
const { compareOffers, evaluateAlert } = require('./pricing');

async function loadOffers(variantId, { includeInactive = false } = {}) {
  const filter = { variantId };
  if (!includeInactive) filter.isActive = true;
  const docs = await MerchantOffer.find(filter).populate('merchantId', 'name domain');
  return docs.map((d) => {
    const o = d.toObject();
    return { ...o, merchant: o.merchantId, merchantId: o.merchantId?._id };
  });
}

async function refreshProduct(productId) {
  const variants = await Variant.find({ productId, isActive: true });
  const prices = variants.map((v) => v.lowestTotal).filter((p) => p !== null && p !== undefined);
  await Product.updateOne(
    { _id: productId },
    {
      startingPrice: prices.length ? Math.min(...prices) : null,
      hasPrice: prices.length > 0,
      availableOfferCount: variants.reduce((s, v) => s + (v.availableOfferCount || 0), 0),
    }
  );
}

async function evaluateAlertsForVariant(variantId) {
  const variant = await Variant.findById(variantId);
  if (!variant) return;
  const alerts = await PriceAlert.find({ variantId });
  await Promise.all(
    alerts.map((a) => PriceAlert.updateOne({ _id: a._id }, evaluateAlert(a, variant.lowestTotal)))
  );
}

/** Recompute the variant's comparison, roll up to product, then re-check alerts. */
async function refreshVariant(variantId) {
  const variant = await Variant.findById(variantId);
  if (!variant) return;
  const offers = await loadOffers(variantId);
  const result = compareOffers(offers);
  variant.lowestTotal = result.lowestTotal;
  variant.availableOfferCount = offers.filter((o) => o.availability === 'in_stock').length;
  await variant.save();
  await refreshProduct(variant.productId);
  await evaluateAlertsForVariant(variantId);
}

const TRACKED = ['price', 'shipping', 'availability'];

function appendHistory(offer, recordedAt = new Date()) {
  return PriceHistory.create({
    offerId: offer._id,
    variantId: offer.variantId,
    productId: offer.productId,
    merchantId: offer.merchantId,
    price: offer.price,
    shipping: offer.shipping ?? null,
    availability: offer.availability,
    recordedAt,
    isSimulated: offer.isSimulated,
  });
}

/**
 * Apply a change to an offer. Every change to price/shipping/availability
 * APPENDS a PriceHistory row; old rows are never touched.
 */
async function applyOfferChange(offer, changes, recordedAt = new Date()) {
  let tracked = false;
  for (const [k, v] of Object.entries(changes)) {
    if (TRACKED.includes(k) && offer[k] !== v) tracked = true;
    offer[k] = v;
  }
  offer.lastUpdatedAt = recordedAt;
  await offer.save();
  if (tracked) await appendHistory(offer, recordedAt);
  await refreshVariant(offer.variantId);
  return offer;
}

module.exports = { loadOffers, refreshVariant, refreshProduct, evaluateAlertsForVariant, applyOfferChange, appendHistory };
