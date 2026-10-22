const { ZodError } = require('zod');
const ApiError = require('../utils/ApiError');

const notFound = (req, res) => res.status(404).json({ error: 'Route not found' });


function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  if (err instanceof ApiError) return res.status(err.status).json({ error: err.message, details: err.details });
  if (err.code === 11000) return res.status(409).json({ error: 'Duplicate record', details: err.keyValue });
  if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid identifier or value' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = { notFound, errorHandler };
