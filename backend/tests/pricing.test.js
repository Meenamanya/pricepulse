const test = require('node:test');
const assert = require('node:assert/strict');
const { compareOffers, summarizeHistory, evaluateAlert, annotate } = require('../src/services/pricing');
const { buildSku, urlMatchesDomain } = require('../src/utils/helpers');

const offer = (id, price, shipping, extra = {}) => ({ _id: id, price, shipping, availability: 'in_stock', isActive: true, merchant: { name: id }, ...extra });

test("brief scenario: Store A is lowest at 28,999; Store C total is unknown", () => {
  const r = compareOffers([offer('A', 28499, 500), offer('B', 29000, 0), offer('C', 28800, null)]);
  assert.equal(r.lowestTotal, 28999);
  assert.deepEqual(r.lowestOfferIds, ['A']);
  const c = r.offers.find((o) => o._id === 'C');
  assert.equal(c.totalCost, null);
  assert.equal(c.status, 'shipping_unknown');
  assert.equal(r.comparisonComplete, false);
  assert.ok(r.notes.length > 0);
});

test('brief scenario: recording Store C shipping = 100 makes it lowest at 28,900', () => {
  const r = compareOffers([offer('A', 28499, 500), offer('B', 29000, 0), offer('C', 28800, 100)]);
  assert.equal(r.lowestTotal, 28900);
  assert.deepEqual(r.lowestOfferIds, ['C']);
  assert.equal(r.comparisonComplete, true);
});

test('unknown shipping is never treated as zero', () => {
  const r = compareOffers([offer('X', 100, null), offer('Y', 150, 0)]);
  assert.equal(r.lowestTotal, 150); // X (100 + ?) must NOT win
});

test('unavailable and inactive offers are never lowest', () => {
  const r = compareOffers([
    offer('cheap-oos', 10, 0, { availability: 'out_of_stock' }),
    offer('cheap-off', 10, 0, { isActive: false }),
    offer('ok', 500, 0),
  ]);
  assert.equal(r.lowestTotal, 500);
  assert.deepEqual(r.lowestOfferIds, ['ok']);
  assert.equal(r.excluded.unavailable, 2);
});

test('no comparable offers -> lowestTotal null and limitation is communicated', () => {
  const r = compareOffers([offer('A', 100, null), offer('B', 90, null)]);
  assert.equal(r.lowestTotal, null);
  assert.equal(r.comparisonComplete, false);
  assert.match(r.notes[0], /cannot be determined/);
});

test('empty offer list', () => {
  const r = compareOffers([]);
  assert.equal(r.lowestTotal, null);
  assert.equal(r.comparisonComplete, true);
});

test('ties: both offers flagged lowest', () => {
  const r = compareOffers([offer('A', 100, 50), offer('B', 150, 0)]);
  assert.deepEqual(r.lowestOfferIds.sort(), ['A', 'B']);
});

test('decimal totals do not suffer float errors', () => {
  assert.equal(annotate(offer('A', 0.1, 0.2)).totalCost, 0.3);
});

test('summarizeHistory computes from records, not hardcoded values', () => {
  const recs = [
    { price: 100, recordedAt: '2026-01-01' },
    { price: 80, recordedAt: '2026-02-01' },
    { price: 120, recordedAt: '2026-03-01' },
    { price: 110, recordedAt: '2026-04-01' },
  ];
  const s = summarizeHistory([recs[2], recs[0], recs[3], recs[1]]); // unsorted input
  assert.equal(s.current.price, 110);
  assert.equal(s.lowest.price, 80);
  assert.equal(s.highest.price, 120);
  assert.equal(s.previous.price, 120);
  assert.equal(s.change, -10);
  assert.equal(s.changePercent, -8.33);
});

test('summarizeHistory edge cases', () => {
  assert.equal(summarizeHistory([]).current, null);
  const one = summarizeHistory([{ price: 5, recordedAt: '2026-01-01' }]);
  assert.equal(one.change, null);
});

test('alert: reached when lowest comparable total <= target (brief example)', () => {
  const a = { targetPrice: 25000, status: 'active' };
  assert.equal(evaluateAlert(a, 25500).status, 'active');
  const hit = evaluateAlert(a, 24999);
  assert.equal(hit.status, 'reached');
  assert.ok(hit.triggeredAt);
  assert.equal(evaluateAlert(a, 25000).status, 'reached'); // boundary is inclusive
});

test('alert: unknown price never triggers; reverting clears the trigger; triggeredAt is stable', () => {
  const a = { targetPrice: 25000, status: 'active' };
  assert.equal(evaluateAlert(a, null).status, 'active');
  const t0 = new Date('2026-05-01');
  const again = evaluateAlert({ targetPrice: 25000, status: 'reached', triggeredAt: t0 }, 24000);
  assert.equal(again.triggeredAt, t0);
  const back = evaluateAlert({ targetPrice: 25000, status: 'reached', triggeredAt: t0 }, 26000);
  assert.equal(back.status, 'active');
  assert.equal(back.triggeredAt, null);
});

test('buildSku: same variant -> same SKU, different RAM/storage -> different SKU', () => {
  const a = buildSku('Samsung', 'Galaxy S24 FE', { storage: '256GB', ram: '8GB', color: 'Blue' });
  const b = buildSku('samsung', 'galaxy s24 fe', { ram: '8GB', storage: '256GB', color: 'Blue' });
  assert.equal(a, b);
  assert.notEqual(a, buildSku('Samsung', 'Galaxy S24 FE', { ram: '8GB', storage: '128GB', color: 'Blue' }));
});

test('urlMatchesDomain accepts merchant domain, rejects others and unsafe schemes', () => {
  assert.ok(urlMatchesDomain('https://www.amazon.in/dp/123', 'amazon.in'));
  assert.ok(urlMatchesDomain('https://smile.amazon.in/x', 'amazon.in'));
  assert.ok(!urlMatchesDomain('https://amazon.in.evil.com/x', 'amazon.in'));
  assert.ok(!urlMatchesDomain('javascript:alert(1)', 'amazon.in'));
  assert.ok(!urlMatchesDomain('not a url', 'amazon.in'));
});
