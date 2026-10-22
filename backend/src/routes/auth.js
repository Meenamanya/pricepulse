const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const S = require('../utils/schemas');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');

const sign = (u) =>
  jwt.sign({ sub: String(u._id), role: u.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role });


router.post('/register', validate(S.register), async (req, res) => {
  const { name, email, password } = req.valid.body;
  if (await User.exists({ email })) throw new ApiError(409, 'Email already registered');
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash, role: 'user' });
  res.status(201).json({ token: sign(user), user: publicUser(user) });
});

router.post('/login', validate(S.login), async (req, res) => {
  const { email, password } = req.valid.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new ApiError(401, 'Invalid email or password');
  res.json({ token: sign(user), user: publicUser(user) });
});

router.get('/me', authenticate, (req, res) => res.json({ user: publicUser(req.user) }));


router.post('/logout', (req, res) => res.json({ message: 'Logged out. Discard the token on the client.' }));

module.exports = router;
