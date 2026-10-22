const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

async function authenticate(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw new ApiError(401, 'Authentication required');
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new ApiError(401, 'Invalid or expired token');
  }
  
  const user = await User.findById(payload.sub).select('name email role');
  if (!user) throw new ApiError(401, 'Invalid or expired token');
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') throw new ApiError(403, 'Admin access required');
  next();
}

module.exports = { authenticate, requireAdmin };
