const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

const validate = (schema, source = 'body') => (req, res, next) => {
  const r = schema.safeParse(req[source]);
  if (!r.success) return next(r.error);
  req.valid = req.valid || {};
  req.valid[source] = r.data;
  next();
};

const validId = (...names) => (req, res, next) => {
  for (const n of names) {
    if (!mongoose.isValidObjectId(req.params[n])) return next(new ApiError(400, `Invalid ${n}`));
  }
  next();
};

module.exports = { validate, validId };
