const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const slug = (s) =>
  String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');


const ATTR_ORDER = ['ram', 'storage', 'color', 'region'];
function buildSku(brand, model, attributes = {}) {
  const parts = [brand, model, ...ATTR_ORDER.map((k) => attributes[k]).filter(Boolean)];
  return parts.map(slug).filter(Boolean).join('-');
}


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
