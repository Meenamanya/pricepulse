// Pure comparison logic (no DB access) so it is easy to unit-test.
const DATA_DISCLAIMER =
  'Prices shown are seeded sample data for demonstration. They are not live market prices.';

const round2 = (n) => Math.round(n * 100) / 100;
const plain = (o) => (o && typeof o.toObject === 'function' ? o.toObject() : { ...o });
const isPurchasable = (o) => o.isActive !== false && o.availability === 'in_stock';

function annotate(offer) {
  const o = plain(offer);
  const shipping = o.shipping === undefined ? null : o.shipping; // unknown stays null
  const totalCost = shipping === null ? null : round2(o.price + shipping);
  const purchasable = isPurchasable(o);
  let status;
  if (o.isActive === false) status = 'inactive';
  else if (!purchasable) status = 'unavailable';
  else if (totalCost === null) status = 'shipping_unknown';
  else status = 'comparable';
  return { ...o, shipping, totalCost, purchasable, comparable: status === 'comparable', status };
}

const RANK = { comparable: 0, shipping_unknown: 1, unavailable: 2, inactive: 3 };

/**
 * offers: offers of ONE variant (caller guarantees this).
 * Lowest total considers only offers that are active, in stock, with known shipping.
 */
function compareOffers(offers) {
  const annotated = offers.map(annotate);
  const comparable = annotated.filter((o) => o.comparable);
  const lowestTotal = comparable.length ? Math.min(...comparable.map((o) => o.totalCost)) : null;

  annotated.forEach((o) => {
    o.isLowest = o.comparable && o.totalCost === lowestTotal;
  });

  annotated.sort((a, b) => {
    if (RANK[a.status] !== RANK[b.status]) return RANK[a.status] - RANK[b.status];
    if (a.status === 'comparable') return a.totalCost - b.totalCost || a.price - b.price;
    return a.price - b.price;
  });

  const unknown = annotated.filter((o) => o.status === 'shipping_unknown');
  const unavailable = annotated.filter((o) => o.status === 'unavailable' || o.status === 'inactive');
  const notes = [];
  if (!comparable.length && unknown.length) {
    notes.push('No offer has a fully known total cost, so a lowest price cannot be determined.');
  }
  if (unknown.length) {
    notes.push(
      `${unknown.length} offer(s) have unknown shipping and are excluded from the lowest total. Their real total could be higher or lower.`
    );
    unknown
      .filter((o) => lowestTotal !== null && o.price < lowestTotal)
      .forEach((o) =>
        notes.push(`The listed price at ${o.merchant?.name || 'one merchant'} is below the lowest known total, but shipping is unknown.`)
      );
  }
  if (unavailable.length) notes.push(`${unavailable.length} offer(s) are unavailable and are not treated as purchasable.`);

  return {
    currency: 'INR',
    lowestTotal,
    lowestOfferIds: annotated.filter((o) => o.isLowest).map((o) => String(o._id)),
    comparisonComplete: unknown.length === 0,
    excluded: { shippingUnknown: unknown.length, unavailable: unavailable.length },
    notes,
    disclaimer: DATA_DISCLAIMER,
    offers: annotated,
  };
}

/** records: price history entries (any order) for one offer. */
function summarizeHistory(records) {
  const sorted = [...records].sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
  if (!sorted.length) return { recordCount: 0, current: null, lowest: null, highest: null, previous: null, change: null, changePercent: null };
  const current = sorted[sorted.length - 1];
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;
  const lowest = sorted.reduce((m, r) => (r.price < m.price ? r : m));
  const highest = sorted.reduce((m, r) => (r.price > m.price ? r : m));
  const change = previous ? round2(current.price - previous.price) : null;
  const changePercent = previous && previous.price > 0 ? round2((change / previous.price) * 100) : null;
  const pick = (r) => (r ? { price: r.price, recordedAt: r.recordedAt } : null);
  return { recordCount: sorted.length, current: pick(current), lowest: pick(lowest), highest: pick(highest), previous: pick(previous), change, changePercent };
}

/** Decide alert state from the variant's lowest comparable total. Pure. */
function evaluateAlert(alert, lowestTotal, now = new Date()) {
  const reached = lowestTotal !== null && lowestTotal !== undefined && lowestTotal <= alert.targetPrice;
  if (reached) {
    const keep = alert.status === 'reached' && alert.triggeredAt;
    return { status: 'reached', currentPrice: lowestTotal, triggeredAt: keep ? alert.triggeredAt : now, lastEvaluatedAt: now };
  }
  return { status: 'active', currentPrice: lowestTotal ?? null, triggeredAt: null, lastEvaluatedAt: now };
}

module.exports = { compareOffers, summarizeHistory, evaluateAlert, annotate, round2, DATA_DISCLAIMER };
