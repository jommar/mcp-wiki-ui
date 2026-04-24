const BASE = import.meta.env.VITE_API_BASE || '/api';

async function get(path, params = {}) {
  const url = new URL(`${BASE}${path}`, location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  info: (wikiId) => get('/wiki/info', { wikiId }),
  sections: (wikiId, limit) => get('/wiki/sections', { wikiId, limit }),
  browse: (topic, wikiId, limit) => get('/wiki/browse', { topic, wikiId, limit }),
  search: (query, wikiId, limit) => get('/wiki/search', { query, wikiId, limit }),
  section: (key, wikiId, offset, limit) =>
    get(`/wiki/section/${encodeURIComponent(key)}`, { wikiId, offset, limit }),
  sectionsBatch: (keys, wikiId) => get('/wiki/sections/batch', { keys: keys.join(','), wikiId }),
  backlinks: (key, wikiId) => get(`/wiki/backlinks/${encodeURIComponent(key)}`, { wikiId }),
  connections: (key, wikiId) => get(`/wiki/connections/${encodeURIComponent(key)}`, { wikiId }),
  linksContent: (key, wikiId, opts = {}) =>
    get(`/wiki/links-content/${encodeURIComponent(key)}`, { wikiId, ...opts }),
  validate: (wikiId) => get('/wiki/validate', { wikiId }),
  history: (key, wikiId, limit) =>
    get(`/wiki/history/${encodeURIComponent(key)}`, { wikiId, limit }),
  graph: (wikiId) => get('/wiki/graph', { wikiId }),
  stats: (wikiId) => get('/wiki/stats', { wikiId }),
};
