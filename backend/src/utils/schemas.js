const { z } = require('zod');
const { CATEGORIES } = require('../models/Product');

const money = z.number().finite().nonnegative().max(10000000)
  .refine((n) => Math.round(n * 100) / 100 === n, 'Max 2 decimal places');
const positive = money.refine((n) => n > 0, 'Must be positive');
const oid = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const attrs = z.object({
  ram: z.string().trim().max(30).optional(),
  storage: z.string().trim().max(30).optional(),
  color: z.string().trim().max(40).optional(),
  region: z.string().trim().max(40).optional(),
}).strict();
const variantInput = z.object({ attributes: attrs, label: z.string().trim().max(120).optional() });
const atLeastOne = (o) => Object.keys(o).length > 0;

module.exports = {
  oid,
  register: z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().toLowerCase().email().max(120),
    password: z.string().min(8).max(100)
      .regex(/[A-Za-z]/, 'Must contain a letter').regex(/\d/, 'Must contain a number'),
  }),
  login: z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(100) }),

  productQuery: z.object({
    q: z.string().trim().max(100).optional(),
    category: z.enum(CATEGORIES).optional(),
    brand: z.string().trim().max(60).optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    sort: z.enum(['price_asc', 'price_desc', 'newest']).default('newest'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
  }).refine((q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice,
    { message: 'minPrice cannot exceed maxPrice', path: ['minPrice'] }),

  productCreate: z.object({
    name: z.string().trim().min(2).max(160),
    brand: z.string().trim().min(1).max(60),
    model: z.string().trim().min(1).max(100),
    category: z.enum(CATEGORIES),
    description: z.string().trim().max(2000).optional(),
    imageUrl: z.string().url().max(500).optional().or(z.literal('')),
    variants: z.array(variantInput).min(1).max(20),
  }),
  productUpdate: z.object({
    name: z.string().trim().min(2).max(160).optional(),
    brand: z.string().trim().min(1).max(60).optional(),
    model: z.string().trim().min(1).max(100).optional(),
    category: z.enum(CATEGORIES).optional(),
    description: z.string().trim().max(2000).optional(),
    imageUrl: z.string().url().max(500).optional().or(z.literal('')),
    isActive: z.boolean().optional(),
  }).refine(atLeastOne, 'Provide at least one field'),
  variantCreate: variantInput,

  merchantCreate: z.object({
    name: z.string().trim().min(2).max(80),
    domain: z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, 'Use a bare domain like amazon.in'),
  }),

  offerCreate: z.object({
    variantId: oid,
    merchantId: oid,
    price: positive,
    shipping: money.nullable().optional(),
    availability: z.enum(['in_stock', 'out_of_stock']).default('in_stock'),
    url: z.string().url().max(1000),
  }),
  offerUpdate: z.object({
    price: positive.optional(),
    shipping: money.nullable().optional(),
    availability: z.enum(['in_stock', 'out_of_stock']).optional(),
    url: z.string().url().max(1000).optional(),
    isActive: z.boolean().optional(),
  }).refine(atLeastOne, 'Provide at least one field'),
  historyCreate: z.object({
    price: positive,
    shipping: money.nullable().optional(),
    availability: z.enum(['in_stock', 'out_of_stock']).optional(),
    recordedAt: z.coerce.date().optional(),
  }),
  historyQuery: z.object({ variantId: oid.optional(), offerId: oid.optional() }),
  compareQuery: z.object({ variantId: oid.optional() }),

  alertCreate: z.object({ productId: oid, variantId: oid, targetPrice: positive }),
  alertUpdate: z.object({ targetPrice: positive }),
};
