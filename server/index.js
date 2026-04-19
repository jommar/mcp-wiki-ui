import express from 'express';
import cors from 'cors';
import { pool } from './db.js';

const app = express();
const PORT = process.env.API_PORT || 3001;

app.use(cors());
app.use(express.json());

const startedAt = Date.now();

app.get('/api/wiki/info', async (req, res) => {
  try {
    const { wikiId } = req.query;
    let rows;
    if (wikiId) {
      ({ rows } = await pool.query(
        'SELECT COUNT(*) as section_count FROM wiki_sections WHERE wiki_id = $1',
        [wikiId],
      ));
      return res.json({
        wikis: [{ wikiId, sectionCount: parseInt(rows[0].section_count) }],
        uptime: (Date.now() - startedAt) / 1000,
      });
    }
    ({ rows } = await pool.query(
      'SELECT wiki_id, COUNT(*) as section_count FROM wiki_sections GROUP BY wiki_id ORDER BY wiki_id',
    ));
    res.json({
      wikis: rows.map((r) => ({ wikiId: r.wiki_id, sectionCount: parseInt(r.section_count) })),
      uptime: (Date.now() - startedAt) / 1000,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/wiki/sections', async (req, res) => {
  try {
    const { wikiId, limit = 500 } = req.query;
    const query = wikiId
      ? 'SELECT key, wiki_id, parent, title, metadata, LENGTH(content) as content_length FROM wiki_sections WHERE wiki_id = $1 ORDER BY key LIMIT $2'
      : 'SELECT key, wiki_id, parent, title, metadata, LENGTH(content) as content_length FROM wiki_sections ORDER BY wiki_id, key LIMIT $1';
    const { rows } = await pool.query(query, wikiId ? [wikiId, limit] : [limit]);
    const sections = rows.map((r) => ({
      key: r.key,
      wikiId: r.wiki_id,
      parent: r.parent || 'Root',
      title: r.title,
      breadcrumbs: r.metadata?.breadcrumbs || [],
      contentLength: r.content_length,
    }));
    res.json({ sections, count: sections.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/wiki/browse', async (req, res) => {
  try {
    const { topic, wikiId, limit = 200 } = req.query;
    let query = `
      SELECT key, wiki_id, parent, title, metadata->>'depth' as depth, metadata->'breadcrumbs' as breadcrumbs
      FROM wiki_sections
    `;
    const params = [];
    const conditions = [];
    if (topic) {
      conditions.push(
        `(LOWER(parent) LIKE $${params.length + 1} OR LOWER(title) LIKE $${params.length + 1} OR metadata->>'breadcrumbs' ILIKE $${params.length + 1})`,
      );
      params.push(`%${topic.toLowerCase()}%`);
    }
    if (wikiId) {
      conditions.push(`wiki_id = $${params.length + 1}`);
      params.push(wikiId);
    }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY parent, key LIMIT $' + (params.length + 1);
    params.push(limit);
    const { rows } = await pool.query(query, params);
    const sections = rows.map((r) => ({
      key: r.key,
      wikiId: r.wiki_id,
      parent: r.parent || 'Root',
      title: r.title,
      depth: parseInt(r.depth) || 2,
      breadcrumbs: r.breadcrumbs || [],
    }));
    const byParent = {};
    for (const s of sections) {
      if (!byParent[s.parent]) byParent[s.parent] = [];
      byParent[s.parent].push(s);
    }
    const groups = Object.entries(byParent).map(([parent, secs]) => ({ parent, sections: secs }));
    res.json({ groups, count: sections.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/wiki/search', async (req, res) => {
  try {
    const { query, wikiId, limit = 20 } = req.query;
    if (!query) return res.status(400).json({ error: 'query is required' });
    const lim = parseInt(limit);
    const params = [];
    let whereClause = '';
    if (wikiId) {
      whereClause = `WHERE wiki_id = $${params.length + 1}`;
      params.push(wikiId);
    }
    const searchTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => t + ':*')
      .join(' & ');
    const searchQuery = `
      SELECT key, wiki_id, parent, title, metadata->'breadcrumbs' as breadcrumbs,
             ts_rank(search_vector, to_tsquery('english', $${params.length + 1})) as rank,
             LENGTH(content) as content_length,
             content
      FROM wiki_sections
      ${whereClause} ${whereClause ? 'AND' : 'WHERE'} search_vector @@ to_tsquery('english', $${params.length + 1})
      ORDER BY rank DESC
      LIMIT $${params.length + 2}
    `;
    params.push(searchTerms, lim);
    const { rows } = await pool.query(searchQuery, params);
    const results = rows.map((r) => {
      const idx = r.content?.toLowerCase().indexOf(query.toLowerCase());
      let snippet;
      if (idx !== undefined && idx >= 0) {
        const start = Math.max(0, idx - 80);
        const end = Math.min(r.content.length, idx + query.length + 80);
        snippet =
          (start > 0 ? '...' : '') +
          r.content.slice(start, end) +
          (end < r.content.length ? '...' : '');
      }
      return {
        key: r.key,
        wikiId: r.wiki_id,
        parent: r.parent || 'Root',
        title: r.title,
        breadcrumbs: r.breadcrumbs || [],
        rank: r.rank,
        contentLength: r.content_length,
        snippet,
      };
    });
    res.json({ results, count: results.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/wiki/section/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { wikiId, offset = 0, limit = 8000 } = req.query;
    const params = [key];
    let whereClause = 'WHERE s.key = $1';
    if (wikiId) {
      whereClause += ' AND s.wiki_id = $2';
      params.push(wikiId);
    }
    const query = `
      SELECT key, wiki_id, parent, title, metadata, content, LENGTH(content) as total_length
      FROM wiki_sections s
      ${whereClause}
    `;
    const { rows } = await pool.query(query, params);
    if (rows.length === 0) return res.status(404).json({ error: `Section '${key}' not found` });
    const row = rows[0];
    const totalLength = row.total_length;
    const rawContent = typeof row.content === 'string' ? row.content : JSON.stringify(row.content);
    const content = rawContent.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    const hasMore = parseInt(offset) + parseInt(limit) < totalLength;
    const prefix = key.split('-').slice(0, 2).join('-');
    const { rows: relatedRows } = await pool.query(
      `SELECT key, title FROM wiki_sections WHERE key LIKE $1 AND key != $2 LIMIT 5`,
      [`${prefix}-%`, key],
    );
    res.json({
      key: row.key,
      title: row.title,
      parent: row.parent || 'Root',
      breadcrumbs: row.metadata?.breadcrumbs || [],
      wikiId: row.wiki_id,
      source: row.metadata?.filePath || '',
      content,
      totalLength,
      offset: parseInt(offset),
      limit: parseInt(limit),
      hasMore,
      nextOffset: hasMore ? parseInt(offset) + parseInt(limit) : undefined,
      relatedSections: relatedRows.map((r) => ({ key: r.key, title: r.title })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/wiki/sections/batch', async (req, res) => {
  try {
    const { keys, wikiId } = req.query;
    if (!keys)
      return res.status(400).json({ error: 'keys query param required (comma-separated)' });
    const keyArr = keys.split(',');
    const params = [keyArr];
    let whereClause = 'WHERE key = ANY($1)';
    if (wikiId) {
      whereClause += ' AND wiki_id = $2';
      params.push(wikiId);
    }
    const { rows } = await pool.query(
      `SELECT key, wiki_id, parent, title, metadata, content, LENGTH(content) as total_length
       FROM wiki_sections ${whereClause} ORDER BY array_position($1, key)`,
      params,
    );
    const truncateLimit = 8000;
    const sections = rows.map((r) => {
      const truncated = r.total_length > truncateLimit;
      return {
        key: r.key,
        wikiId: r.wiki_id,
        parent: r.parent || 'Root',
        title: r.title,
        breadcrumbs: r.metadata?.breadcrumbs || [],
        source: r.metadata?.filePath || '',
        content: truncated ? r.content.slice(0, truncateLimit) : r.content,
        truncated,
        totalLength: truncated ? r.total_length : undefined,
      };
    });
    res.json({ sections, successCount: sections.length, errorCount: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/wiki/backlinks/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { wikiId } = req.query;
    const params = [key];
    let whereClause = 'WHERE sl.to_key = $1';
    if (wikiId) {
      whereClause += ' AND sl.to_wiki_id = $2';
      params.push(wikiId);
    }
    const query = `
      SELECT sl.from_key, sl.from_wiki_id, ws.title as from_title, ws.parent as from_parent
      FROM section_links sl
      JOIN wiki_sections ws ON ws.wiki_id = sl.from_wiki_id AND ws.key = sl.from_key
      ${whereClause}
      ORDER BY ws.title
    `;
    const { rows } = await pool.query(query, params);
    res.json({
      backlinks: rows.map((r) => ({
        key: r.from_key,
        wikiId: r.from_wiki_id,
        title: r.from_title,
        parent: r.from_parent || 'Root',
      })),
      count: rows.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/wiki/connections/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { wikiId } = req.query;
    let inboundWhere = 'WHERE sl.to_key = $1';
    let outboundWhere = 'WHERE sl.from_key = $1';
    const params = [key];
    if (wikiId) {
      inboundWhere += ' AND sl.to_wiki_id = $2';
      outboundWhere += ' AND sl.from_wiki_id = $2';
      params.push(wikiId);
    }
    // Inbound: sections that link TO this section
    const inboundQuery = `
      SELECT sl.from_key, sl.from_wiki_id, ws.title as title, ws.parent as parent
      FROM section_links sl
      JOIN wiki_sections ws ON ws.wiki_id = sl.from_wiki_id AND ws.key = sl.from_key
      ${inboundWhere}
      ORDER BY ws.title
    `;
    // Outbound: sections this section links TO
    const outboundQuery = `
      SELECT sl.to_key, sl.to_wiki_id, ws.title as title, ws.parent as parent
      FROM section_links sl
      JOIN wiki_sections ws ON ws.wiki_id = sl.to_wiki_id AND ws.key = sl.to_key
      ${outboundWhere}
      ORDER BY ws.title
    `;
    const [inboundRes, outboundRes] = await Promise.all([
      pool.query(inboundQuery, params),
      pool.query(outboundQuery, params),
    ]);
    res.json({
      inbound: inboundRes.rows.map((r) => ({
        key: r.from_key,
        wikiId: r.from_wiki_id,
        title: r.title,
        parent: r.parent || 'Root',
      })),
      outbound: outboundRes.rows.map((r) => ({
        key: r.to_key,
        wikiId: r.to_wiki_id,
        title: r.title,
        parent: r.parent || 'Root',
      })),
      count: inboundRes.rows.length + outboundRes.rows.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/wiki/validate', async (req, res) => {
  try {
    const { wikiId } = req.query;
    const params = [];
    let whereClause = '';
    if (wikiId) {
      whereClause = `WHERE wiki_id = $1`;
      params.push(wikiId);
    }
    const { rows: empty } = await pool.query(
      `SELECT key, title FROM wiki_sections ${whereClause} ${whereClause ? 'AND' : 'WHERE'} content = '' OR content IS NULL`,
      params,
    );
    const { rows: orphans } = await pool.query(
      `SELECT s.key, s.title, s.parent FROM wiki_sections s
       ${whereClause} ${whereClause ? 'AND' : 'WHERE'} (
         s.parent IS NULL
         AND NOT EXISTS (SELECT 1 FROM wiki_sections c WHERE c.parent = s.title AND c.wiki_id = s.wiki_id)
         AND NOT EXISTS (SELECT 1 FROM section_links sl WHERE sl.to_key = s.key AND sl.to_wiki_id = s.wiki_id)
       )`,
      params,
    );
    const { rows: unlinked } = await pool.query(
      `SELECT s.key, s.title FROM wiki_sections s
       ${whereClause} ${whereClause ? 'AND' : 'WHERE'} NOT EXISTS (
         SELECT 1 FROM section_links sl WHERE sl.to_key = s.key AND sl.to_wiki_id = s.wiki_id
       ) AND s.parent IS NOT NULL`,
      params,
    );
    res.json({
      emptySections: empty.map((r) => ({ key: r.key, title: r.title })),
      orphanedSections: orphans.map((r) => ({ key: r.key, title: r.title })),
      unlinkedSections: unlinked.map((r) => ({ key: r.key, title: r.title })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/wiki/history/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { wikiId, limit = 10 } = req.query;
    if (!wikiId) return res.status(400).json({ error: 'wikiId is required' });
    const { rows } = await pool.query(
      `SELECT content_before, content_after, changed_at, change_reason
       FROM section_history
       WHERE wiki_id = $1 AND section_key = $2
       ORDER BY changed_at DESC
       LIMIT $3`,
      [wikiId, key, parseInt(limit)],
    );
    res.json({
      history: rows.map((h) => ({
        contentBefore: h.content_before ?? undefined,
        contentAfter: h.content_after,
        changedAt: h.changed_at instanceof Date ? h.changed_at.toISOString() : String(h.changed_at),
        changeReason: h.change_reason ?? undefined,
      })),
      count: rows.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/wiki/graph', async (req, res) => {
  try {
    const { wikiId } = req.query;
    const params = [];
    let whereClause = '';
    if (wikiId) {
      whereClause = `WHERE wiki_id = $1`;
      params.push(wikiId);
    }
    const { rows: sections } = await pool.query(
      `SELECT key, wiki_id, parent, title, LENGTH(content) as content_length FROM wiki_sections ${whereClause}`,
      params,
    );
    const { rows: links } = await pool.query(
      `SELECT sl.from_key, sl.from_wiki_id, sl.to_key, sl.to_wiki_id
       FROM section_links sl
       INNER JOIN wiki_sections ws_from ON ws_from.key = sl.from_key AND ws_from.wiki_id = sl.from_wiki_id
       INNER JOIN wiki_sections ws_to ON ws_to.key = sl.to_key AND ws_to.wiki_id = sl.to_wiki_id
       ${wikiId ? 'WHERE ws_from.wiki_id = $1 AND ws_to.wiki_id = $1' : ''}`,
      wikiId ? [wikiId] : [],
    );
    const nodes = sections.map((s) => ({
      id: s.key,
      wikiId: s.wiki_id,
      title: s.title,
      parent: s.parent || 'Root',
      contentLength: s.content_length,
    }));
    const edges = links.map((l) => ({
      source: l.from_key,
      target: l.to_key,
      sourceWikiId: l.from_wiki_id,
      targetWikiId: l.to_wiki_id,
    }));
    res.json({ nodes, edges, nodeCount: nodes.length, edgeCount: edges.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Wiki API server running on http://localhost:${PORT}`);
});
