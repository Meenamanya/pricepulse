const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
export const money = (n) => (n === null || n === undefined ? 'Unknown' : inr.format(n));
export const when = (d) => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'None');
export const day = (t) => new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
export const label = (s) => (s || '').replace(/-/g, ' ');
export const safeUrl = (u) => /^https?:\/\//i.test(u || '');
export const variantName = (v) => v?.label || Object.values(v?.attributes || {}).filter(Boolean).join(' / ') || 'Standard';
