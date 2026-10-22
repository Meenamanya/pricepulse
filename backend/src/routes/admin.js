const router = require('express').Router();
const Product = require('../models/Product');
const MerchantOffer = require('../models/MerchantOffer');
const PriceAlert = require('../models/PriceAlert');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate, requireAdmin);

router.get('/analytics', async (req, res) => {
  const [totalProducts, activeProducts, totalOffers, activeOffers, unavailableOffers, inactiveOffers, reachedCount] =
    await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ isActive: true }),
      MerchantOffer.countDocuments(),
      MerchantOffer.countDocuments({ isActive: true, availability: 'in_stock' }),
      MerchantOffer.countDocuments({ isActive: true, availability: 'out_of_stock' }),
      MerchantOffer.countDocuments({ isActive: false }),
      PriceAlert.countDocuments({ status: 'reached' }),
    ]);

  
  const spreads = await MerchantOffer.aggregate([
    { $match: { isActive: true, availability: 'in_stock', shipping: { $ne: null } } },
    { $addFields: { total: { $add: ['$price', '$shipping'] } } },
    { $group: { _id: '$variantId', productId: { $first: '$productId' }, min: { $min: '$total' }, max: { $max: '$total' }, offers: { $sum: 1 } } },
    { $match: { offers: { $gte: 2 } } },
    { $addFields: { difference: { $subtract: ['$max', '$min'] } } },
    { $sort: { difference: -1 } },
    { $limit: 5 },
    { $lookup: { from: 'products', localField: 'productId', foreignField: '_id', as: 'product' } },
    { $lookup: { from: 'variants', localField: '_id', foreignField: '_id', as: 'variant' } },
    { $unwind: '$product' },
    { $unwind: '$variant' },
    { $project: { _id: 0, productId: 1, productName: '$product.name', variantLabel: '$variant.label', variantAttributes: '$variant.attributes', min: 1, max: 1, difference: 1, offers: 1 } },
  ]);

  const reached = await PriceAlert.find({ status: 'reached' })
    .sort({ triggeredAt: -1 }).limit(20)
    .populate('productId', 'name').populate('variantId', 'label attributes').populate('userId', 'email').lean();

  res.json({
    totals: { products: totalProducts, activeProducts, offers: totalOffers, activeOffers, unavailableOffers, inactiveOffers },
    largestPriceDifferences: spreads,
    targetsReached: {
      count: reachedCount,
      items: reached.map((a) => ({
        alertId: a._id, product: a.productId?.name, variant: a.variantId?.label || a.variantId?.attributes,
        user: a.userId?.email, targetPrice: a.targetPrice, currentPrice: a.currentPrice, triggeredAt: a.triggeredAt,
      })),
    },
  });
});

module.exports = router;
