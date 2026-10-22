const router = require('express').Router();
const PriceAlert = require('../models/PriceAlert');
const Variant = require('../models/Variant');
const ApiError = require('../utils/ApiError');
const S = require('../utils/schemas');
const { authenticate } = require('../middleware/auth');
const { validate, validId } = require('../middleware/validate');
const { evaluateAlert } = require('../services/pricing');

router.use(authenticate);

const populateOpts = [
  { path: 'productId', select: 'name brand model imageUrl' },
  { path: 'variantId', select: 'label attributes lowestTotal' },
];

router.get('/', async (req, res) => {
  const alerts = await PriceAlert.find({ userId: req.user._id }).sort({ createdAt: -1 }).populate(populateOpts).lean();
  res.json({ data: alerts });
});

router.post('/', validate(S.alertCreate), async (req, res) => {
  const { productId, variantId, targetPrice } = req.valid.body;
  const variant = await Variant.findOne({ _id: variantId, productId, isActive: true });
  if (!variant) throw new ApiError(404, 'Variant not found for this product');
  if (await PriceAlert.exists({ userId: req.user._id, variantId })) {
    throw new ApiError(409, 'You already have an alert for this variant. Update it instead.');
  }
  const alert = new PriceAlert({ userId: req.user._id, productId, variantId, targetPrice });
  Object.assign(alert, evaluateAlert(alert, variant.lowestTotal)); 
  await alert.save();
  res.status(201).json({ alert });
});

router.put('/:id', validId('id'), validate(S.alertUpdate), async (req, res) => {
  const alert = await PriceAlert.findOne({ _id: req.params.id, userId: req.user._id }); 
  if (!alert) throw new ApiError(404, 'Alert not found');
  const variant = await Variant.findById(alert.variantId);
  alert.targetPrice = req.valid.body.targetPrice;
  Object.assign(alert, evaluateAlert(alert, variant?.lowestTotal ?? null));
  await alert.save();
  res.json({ alert });
});

router.delete('/:id', validId('id'), async (req, res) => {
  const r = await PriceAlert.deleteOne({ _id: req.params.id, userId: req.user._id });
  if (!r.deletedCount) throw new ApiError(404, 'Alert not found');
  res.json({ message: 'Alert deleted' });
});

module.exports = router;
