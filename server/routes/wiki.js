import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();
const startedAt = Date.now();

router.get('/info', async (req, res) => {
  try {
    const { wikiId } = req.query;
    if (wikiId) {
      const { rows } = await pool.query(
        'SELECT COUNT(*) as section_count FROM wiki_sections WHERE wiki_id = $1',
        [wikiId],
      );
      return res.json({
        wikis: [{ wikiId, sectionCount: parseInt(rows[0].section_count) }],
        uptime: (Date.now() - startedAt) / 1000,
      });
    }
    const { rows } = await pool.query(
      'SELECT wiki_id, COUNT(*) as section_count FROM wiki_sections GROUP BY wiki_id ORDER BY wiki_id',
    );
    res.json({
      wikis: rows.map((r) => ({ wikiId: r.wiki_id, sectionCount: parseInt(r.section_count) })),
      uptime: (Date.now() - startedAt) / 1000,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sections', async (req, res) => {
  try {
    const { wikiId, limit = 500 } = req.query;
    const q = wikiId
      ? 'SELECT key, wiki_id, parent, title, tags, metadata, access_count, last_accessed, LENGTH(content) as content_length FROM wiki_sections WHERE wiki_id = $1 ORDER BY key LIMIT $2'
      : 'SELECT key, wiki_id, parent, title, tags, metadata, access_count, last_accessed, LENGTH(content) as content_length FROM wiki_sections ORDER BY wiki_id, key LIMIT $1';
    const { rows } = await pool.query(q, wikiId ? [wikiId, limit] : [limit]);
    res.json({
      sections: rows.map((r) => ({
        key: r.key,
        wikiId: r.wiki_id,
        parent: r.parent || 'Root',
        title: r.title,
        tags: r.tags || [],
        breadcrumbs: r.metadata?.breadcrumbs || [],
        accessCount: r.access_count || 0,
        lastAccessed: r.last_accessed,
        contentLength: parseInt(r.content_length),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/browse', async (req, res) => {
  try {
    const { topic, wikiId, limit = 200 } = req.query;
    const conditions = [];
    const params = [];
    if (topic) {
      conditions.push(
        `(LOWER(parent) LIKE $${params.length + 1} OR LOWER(title) LIKE $${params.length + 1})`,
      );
      params.push(`%${topic.toLowerCase()}%`);
    }
    if (wikiId) {
      conditions.push(`wiki_id = $${params.length + 1}`);
      params.push(wikiId);
    }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    params.push(limit);
    const { rows } = await pool.query(
      `SELECT key, wiki_id, parent, title, tags, LENGTH(content) as content_length FROM wiki_sections ${where} ORDER BY parent, key LIMIT $${params.length}`,
      params,
    );
    const byParent = {};
    for (const r of rows) {
      const p = r.parent || 'Root';
      if (!byParent[p]) byParent[p] = [];
      byParent[p].push({ key: r.key, wikiId: r.wiki_id, parent: p, title: r.title, tags: r.tags || [], contentLength: parseInt(r.content_length) });
    }
    res.json({
      groups: Object.entries(byParent).map(([parent, sections]) => ({ parent, sections })),
      count: rows.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/search', async (req, res) => {
  try {
    const { query, wikiId, limit = 20 } = req.query;
    if (!query) return res.status(400).json({ error: 'query is required' });
    const lim = Math.min(parseInt(limit), 50);
    const params = [];
    let where = '';
    if (wikiId) {
      where = `WHERE wiki_id = $${params.length + 1}`;
      params.push(wikiId);
    }
    const searchTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => t + ':*')
      .join(' & ');
    const tagPatterns = query
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => `%${t}%`);
    const tagClauses = tagPatterns.map((_, i) =>
      `EXISTS (SELECT 1 FROM jsonb_array_elements_text(tags::jsonb) AS tag WHERE tag ILIKE $${params.length + 1 + i})`
    ).join(' OR ');
    const tagCondition = tagClauses.length ? ` OR ${tagClauses}` : '';
    const tagParams = tagPatterns;
    const { rows } = await pool.query(
      `SELECT key, wiki_id, parent, title, tags, access_count,
              ts_rank(search_vector, to_tsquery('english', $${params.length + 1})) as rank,
              content
       FROM wiki_sections
       ${where} ${where ? 'AND' : 'WHERE'} (
         search_vector @@ to_tsquery('english', $${params.length + 1})
         ${tagCondition}
       )
       ORDER BY rank DESC LIMIT $${params.length + 2}`,
     [...params, searchTerms, ...tagParams, lim],
    );
    res.json({
      results: rows.map((r) => {
        const idx = r.content?.toLowerCase().indexOf(query.toLowerCase()) ?? -1;
        let snippet;
        if (idx >= 0) {
          const start = Math.max(0, idx - 80);
          const end = Math.min(r.content.length, idx + query.length + 80);
          snippet = (start > 0 ? '…' : '') + r.content.slice(start, end) + (end < r.content.length ? '…' : '');
        }
        return {
          key: r.key,
          wikiId: r.wiki_id,
          parent: r.parent || 'Root',
          title: r.title,
          tags: r.tags || [],
          rank: r.rank,
          accessCount: r.access_count || 0,
          snippet,
        };
      }),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/section/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { wikiId, offset = 0, limit = 8000 } = req.query;
    const params = [key];
    let where = 'WHERE key = $1';
    if (wikiId) { where += ' AND wiki_id = $2'; params.push(wikiId); }
    const { rows } = await pool.query(
      `SELECT key, wiki_id, parent, title, tags, metadata, content, access_count, last_accessed, LENGTH(content) as total_length
       FROM wiki_sections ${where}`,
      params,
    );
    if (!rows.length) return res.status(404).json({ error: `Section '${key}' not found` });
    const row = rows[0];
    const totalLength = parseInt(row.total_length);
    const content = row.content.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    const hasMore = parseInt(offset) + parseInt(limit) < totalLength;
    // Related sections by prefix
    const prefix = key.split('-').slice(0, 2).join('-');
    const { rows: related } = await pool.query(
      'SELECT key, title FROM wiki_sections WHERE key LIKE $1 AND key != $2 LIMIT 6',
      [`${prefix}-%`, key],
    );
    // Increment access count
    pool.query(
      'UPDATE wiki_sections SET access_count = access_count + 1, last_accessed = NOW() WHERE key = $1' + (wikiId ? ' AND wiki_id = $2' : ''),
      wikiId ? [key, wikiId] : [key],
    ).catch(() => {});
    res.json({
      key: row.key,
      wikiId: row.wiki_id,
      parent: row.parent || 'Root',
      title: row.title,
      tags: row.tags || [],
      breadcrumbs: row.metadata?.breadcrumbs || [],
      source: row.metadata?.filePath || '',
      content,
      totalLength,
      hasMore,
      nextOffset: hasMore ? parseInt(offset) + parseInt(limit) : undefined,
      accessCount: row.access_count || 0,
      lastAccessed: row.last_accessed,
      relatedSections: related.map((r) => ({ key: r.key, title: r.title })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sections/batch', async (req, res) => {
  try {
    const { keys, wikiId } = req.query;
    if (!keys) return res.status(400).json({ error: 'keys required (comma-separated)' });
    const keyArr = keys.split(',');
    const params = [keyArr];
    let where = 'WHERE key = ANY($1)';
    if (wikiId) { where += ' AND wiki_id = $2'; params.push(wikiId); }
    const { rows } = await pool.query(
      `SELECT key, wiki_id, parent, title, tags, metadata, content, LENGTH(content) as total_length
       FROM wiki_sections ${where} ORDER BY array_position($1, key)`,
      params,
    );
    res.json({
      sections: rows.map((r) => ({
        key: r.key,
        wikiId: r.wiki_id,
        parent: r.parent || 'Root',
        title: r.title,
        tags: r.tags || [],
        breadcrumbs: r.metadata?.breadcrumbs || [],
        content: r.content.slice(0, 8000),
        truncated: parseInt(r.total_length) > 8000,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/backlinks/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { wikiId } = req.query;
    const params = [key];
    let where = 'WHERE sl.to_key = $1';
    if (wikiId) { where += ' AND sl.to_wiki_id = $2'; params.push(wikiId); }
    const { rows } = await pool.query(
      `SELECT sl.from_key, sl.from_wiki_id, ws.title, ws.parent
       FROM section_links sl
       JOIN wiki_sections ws ON ws.wiki_id = sl.from_wiki_id AND ws.key = sl.from_key
       ${where} ORDER BY ws.title`,
      params,
    );
    res.json({
      backlinks: rows.map((r) => ({ key: r.from_key, wikiId: r.from_wiki_id, title: r.title, parent: r.parent || 'Root' })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/connections/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { wikiId } = req.query;
    const params = [key];
    let wikiFilter = '';
    if (wikiId) { wikiFilter = ' AND $2'; params.push(wikiId); }
    const inboundWhere = `WHERE sl.to_key = $1${wikiId ? ' AND sl.to_wiki_id = $2' : ''}`;
    const outboundWhere = `WHERE sl.from_key = $1${wikiId ? ' AND sl.from_wiki_id = $2' : ''}`;
    const [inbound, outbound] = await Promise.all([
      pool.query(
        `SELECT sl.from_key as key, sl.from_wiki_id as wiki_id, ws.title, ws.parent
         FROM section_links sl JOIN wiki_sections ws ON ws.wiki_id = sl.from_wiki_id AND ws.key = sl.from_key
         ${inboundWhere} ORDER BY ws.title`,
        params,
      ),
      pool.query(
        `SELECT sl.to_key as key, sl.to_wiki_id as wiki_id, ws.title, ws.parent
         FROM section_links sl JOIN wiki_sections ws ON ws.wiki_id = sl.to_wiki_id AND ws.key = sl.to_key
         ${outboundWhere} ORDER BY ws.title`,
        params,
      ),
    ]);
    res.json({
      inbound: inbound.rows.map((r) => ({ key: r.key, wikiId: r.wiki_id, title: r.title, parent: r.parent || 'Root' })),
      outbound: outbound.rows.map((r) => ({ key: r.key, wikiId: r.wiki_id, title: r.title, parent: r.parent || 'Root' })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/links-content/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { wikiId, incoming = 'true', outgoing = 'false' } = req.query;
    const fetchIn = incoming !== 'false';
    const fetchOut = outgoing === 'true';
    const params = [key];
    if (wikiId) params.push(wikiId);
    const wp = wikiId ? ` AND wiki_id = $2` : '';
    let linkWhere = '';
    if (fetchIn && fetchOut) linkWhere = 'WHERE sl.to_key = $1 OR sl.from_key = $1';
    else if (fetchIn) linkWhere = 'WHERE sl.to_key = $1';
    else linkWhere = 'WHERE sl.from_key = $1';
    if (wikiId) {
      if (fetchIn && fetchOut) linkWhere += ` AND (sl.to_wiki_id = $2 OR sl.from_wiki_id = $2)`;
      else if (fetchIn) linkWhere += ` AND sl.to_wiki_id = $2`;
      else linkWhere += ` AND sl.from_wiki_id = $2`;
    }
    const joinCondition = fetchIn && fetchOut
      ? '(sl.to_key = $1 AND ws.key = sl.from_key AND ws.wiki_id = sl.from_wiki_id) OR (sl.from_key = $1 AND ws.key = sl.to_key AND ws.wiki_id = sl.to_wiki_id)'
      : fetchIn
        ? 'sl.to_key = $1 AND ws.key = sl.from_key AND ws.wiki_id = sl.from_wiki_id'
        : 'sl.from_key = $1 AND ws.key = sl.to_key AND ws.wiki_id = sl.to_wiki_id';
    const { rows } = await pool.query(
      `SELECT DISTINCT ws.key, ws.wiki_id, ws.parent, ws.title, ws.content
       FROM wiki_sections ws WHERE ws.key = $1${wp}
       UNION
       SELECT DISTINCT ws.key, ws.wiki_id, ws.parent, ws.title, ws.content
       FROM section_links sl JOIN wiki_sections ws ON (${joinCondition}) ${linkWhere}`,
      params,
    );
    rows.sort((a, b) => a.key === key ? -1 : b.key === key ? 1 : a.title.localeCompare(b.title));
    res.json({
      sections: rows.map((r) => ({ key: r.key, wikiId: r.wiki_id, title: r.title, parent: r.parent || 'Root', content: r.content })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/validate', async (req, res) => {
  try {
    const { wikiId } = req.query;
    const params = [];
    const where = wikiId ? (params.push(wikiId), 'WHERE wiki_id = $1') : '';
    const andOr = where ? 'AND' : 'WHERE';
    const [empty, orphans] = await Promise.all([
      pool.query(`SELECT key, title FROM wiki_sections ${where} ${andOr} (content = '' OR content IS NULL)`, params),
      pool.query(
        `SELECT s.key, s.title FROM wiki_sections s ${where} ${andOr} (
          s.parent IS NULL
          AND NOT EXISTS (SELECT 1 FROM wiki_sections c WHERE c.parent = s.title AND c.wiki_id = s.wiki_id)
          AND NOT EXISTS (SELECT 1 FROM section_links sl WHERE sl.to_key = s.key AND sl.to_wiki_id = s.wiki_id)
        )`,
        params,
      ),
    ]);
    res.json({
      emptySections: empty.rows.map((r) => ({ key: r.key, title: r.title })),
      orphanedSections: orphans.rows.map((r) => ({ key: r.key, title: r.title })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { wikiId, limit = 10 } = req.query;
    if (!wikiId) return res.status(400).json({ error: 'wikiId is required' });
    const { rows } = await pool.query(
      `SELECT content_before, content_after, changed_at, change_reason
       FROM section_history WHERE wiki_id = $1 AND section_key = $2
       ORDER BY changed_at DESC LIMIT $3`,
      [wikiId, key, parseInt(limit)],
    );
    res.json({
      history: rows.map((h) => ({
        contentBefore: h.content_before ?? undefined,
        contentAfter: h.content_after,
        changedAt: h.changed_at instanceof Date ? h.changed_at.toISOString() : String(h.changed_at),
        changeReason: h.change_reason ?? undefined,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/graph', async (req, res) => {
  try {
    const { wikiId } = req.query;
    const params = wikiId ? [wikiId] : [];
    const where = wikiId ? 'WHERE wiki_id = $1' : '';
    const [sections, links] = await Promise.all([
      pool.query(
        `SELECT key, wiki_id, parent, title, LENGTH(content) as content_length FROM wiki_sections ${where}`,
        params,
      ),
      pool.query(
        `SELECT sl.from_key, sl.from_wiki_id, sl.to_key, sl.to_wiki_id
         FROM section_links sl
         INNER JOIN wiki_sections wf ON wf.key = sl.from_key AND wf.wiki_id = sl.from_wiki_id
         INNER JOIN wiki_sections wt ON wt.key = sl.to_key AND wt.wiki_id = sl.to_wiki_id
         ${wikiId ? 'WHERE wf.wiki_id = $1 AND wt.wiki_id = $1' : ''}`,
        params,
      ),
    ]);
    res.json({
      nodes: sections.rows.map((s) => ({
        id: s.key,
        wikiId: s.wiki_id,
        title: s.title,
        parent: s.parent || 'Root',
        contentLength: parseInt(s.content_length),
      })),
      edges: links.rows.map((l) => ({ source: l.from_key, target: l.to_key })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const { wikiId } = req.query;
    const params = wikiId ? [wikiId] : [];
    const where = wikiId ? 'WHERE wiki_id = $1' : '';
    const [counts, topAccessed, topLinked, recentlyEdited] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) as total, COUNT(CASE WHEN content != '' THEN 1 END) as with_content
         FROM wiki_sections ${where}`,
        params,
      ),
      pool.query(
        `SELECT key, title, access_count, last_accessed FROM wiki_sections ${where}
         ${where ? 'AND' : 'WHERE'} access_count > 0 ORDER BY access_count DESC LIMIT 10`,
        params,
      ),
      pool.query(
        `SELECT ws.key, ws.title, COUNT(*) as link_count
         FROM section_links sl
         JOIN wiki_sections ws ON ws.key = sl.to_key AND ws.wiki_id = sl.to_wiki_id
         ${wikiId ? 'WHERE ws.wiki_id = $1' : ''}
         GROUP BY ws.key, ws.title ORDER BY link_count DESC LIMIT 10`,
        params,
      ),
      pool.query(
        `SELECT DISTINCT ON (section_key) section_key as key, content_after, changed_at, change_reason
         FROM section_history ${wikiId ? 'WHERE wiki_id = $1' : ''}
         ORDER BY section_key, changed_at DESC LIMIT 10`,
        params,
      ),
    ]);
    const { total, with_content } = counts.rows[0];
    const { rows: linkCount } = await pool.query(
      `SELECT COUNT(*) as total FROM section_links sl
       ${wikiId ? 'INNER JOIN wiki_sections wf ON wf.key = sl.from_key AND wf.wiki_id = sl.from_wiki_id WHERE wf.wiki_id = $1' : ''}`,
      params,
    );
    res.json({
      totalSections: parseInt(total),
      sectionsWithContent: parseInt(with_content),
      totalLinks: parseInt(linkCount[0].total),
      topAccessed: topAccessed.rows.map((r) => ({ key: r.key, title: r.title, accessCount: r.access_count, lastAccessed: r.last_accessed })),
      topLinked: topLinked.rows.map((r) => ({ key: r.key, title: r.title, linkCount: parseInt(r.link_count) })),
      recentlyEdited: recentlyEdited.rows.map((r) => ({ key: r.key, changedAt: r.changed_at, changeReason: r.change_reason })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
