const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const slug = (s) =>
  String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Attribute order is fixed so the same variant always yields the same SKU.
const ATTR_ORDER = ['ram', 'storage', 'color', 'region'];
function buildSku(brand, model, attributes = {}) {
  const parts = [brand, model, ...ATTR_ORDER.map((k) => attributes[k]).filter(Boolean)];
  return parts.map(slug).filter(Boolean).join('-');
}

// Offer URL host must belong to the merchant's registered domain.
function urlMatchesDomain(url, domain) {
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const d = domain.toLowerCase().replace(/^www\./, '');
    return host === d || host.endsWith('.' + d);
  } catch {
    return false;
  }
}

module.exports = { escapeRegex, slug, buildSku, urlMatchesDomain, ATTR_ORDER };
