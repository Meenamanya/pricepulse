const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
const KEY = 'pp_token';

export const getToken = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const setToken = (t) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* storage blocked */ } };

export async function api(path, { method = 'GET', body } = {}) {
  const token = getToken();
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    const e = new Error('Cannot reach the server. Check your connection and try again.');
    e.status = 0;
    throw e;
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    if (res.status === 401 && token) window.dispatchEvent(new Event('pp-logout')); // expired token
    const detail = Array.isArray(data?.details) ? ' ' + data.details.map((d) => `${d.path ? d.path + ': ' : ''}${d.message}`).join('; ') : '';
    const e = new Error((data?.error || 'Request failed') + detail);
    e.status = res.status;
    throw e;
  }
  return data;
}
