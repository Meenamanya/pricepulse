const router = require('express').Router();
const Watchlist = require('../models/Watchlist');
const Product = require('../models/Product');
const Variant = require('../models/Variant');
const PriceAlert = require('../models/PriceAlert');
const ApiError = require('../utils/ApiError');
const { authenticate } = require('../middleware/auth');
const { validId } = require('../middleware/validate');

router.use(authenticate);


router.get('/', async (req, res) => {
  const items = await Watchlist.find({ userId: req.user._id }).sort({ createdAt: -1 }).populate('productId').lean();
  const alerts = await PriceAlert.find({ userId: req.user._id }).populate('variantId', 'label attributes lowestTotal').lean();
  const data = items
    .filter((i) => i.productId && i.productId.isActive)
    .map((i) => ({
      addedAt: i.createdAt,
      product: i.productId,
      alerts: alerts.filter((a) => String(a.productId) === String(i.productId._id)),
    }));
  res.json({ data });
});

router.post('/:productId', validId('productId'), async (req, res) => {
  const product = await Product.findOne({ _id: req.params.productId, isActive: true });
  if (!product) throw new ApiError(404, 'Product not found');
  const r = await Watchlist.updateOne(
    { userId: req.user._id, productId: product._id },
    { $setOnInsert: { userId: req.user._id, productId: product._id } },
    { upsert: true }
  );
  res.status(r.upsertedCount ? 201 : 200).json({ message: r.upsertedCount ? 'Added to watchlist' : 'Already in watchlist' });
});

router.delete('/:productId', validId('productId'), async (req, res) => {
  const r = await Watchlist.deleteOne({ userId: req.user._id, productId: req.params.productId });
  if (!r.deletedCount) throw new ApiError(404, 'Product not in your watchlist');
  res.json({ message: 'Removed from watchlist' });
});

module.exports = router;
