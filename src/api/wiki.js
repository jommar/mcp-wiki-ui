const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

async function fetchApi(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const wikiApi = {
  getInfo: (wikiId) => fetchApi('/wiki/info', { wikiId }),
  getSections: (wikiId, limit = 500) => fetchApi('/wiki/sections', { wikiId, limit }),
  browse: (topic, wikiId, limit = 200) => fetchApi('/wiki/browse', { topic, wikiId, limit }),
  search: (query, wikiId, fuzzy = false, limit = 20) =>
    fetchApi('/wiki/search', { query, wikiId, fuzzy, limit }),
  getSection: (key, wikiId, offset = 0, limit = 8000) =>
    fetchApi(`/wiki/section/${encodeURIComponent(key)}`, { wikiId, offset, limit }),
  getSectionsBatch: (keys, wikiId) =>
    fetchApi('/wiki/sections/batch', { keys: keys.join(','), wikiId }),
  getBacklinks: (key, wikiId) => fetchApi(`/wiki/backlinks/${encodeURIComponent(key)}`, { wikiId }),
  getBacklinksContent: (key, wikiId) =>
    fetchApi(`/wiki/backlinks-content/${encodeURIComponent(key)}`, { wikiId }),
  getConnections: (key, wikiId) =>
    fetchApi(`/wiki/connections/${encodeURIComponent(key)}`, { wikiId }),
  validate: (wikiId) => fetchApi('/wiki/validate', { wikiId }),
  getHistory: (key, wikiId, limit = 10) =>
    fetchApi(`/wiki/history/${encodeURIComponent(key)}`, { wikiId, limit }),
  getGraph: (wikiId) => fetchApi('/wiki/graph', { wikiId }),
};
