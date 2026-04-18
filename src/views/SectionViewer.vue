<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { wikiApi } from '../api/wiki.js';
import { marked } from 'marked';

const props = defineProps({ sectionKey: String, wikiId: String });
const router = useRouter();

const section = ref(null);
const backlinks = ref([]);
const history = ref([]);
const related = ref([]);
const loading = ref(true);
const activeTab = ref('content');
const contentOffset = ref(0);
const contentLimit = ref(8000);
const historyLimit = ref(10);
const showDiff = ref(false);
const diffIndex = ref(0);
const contentContainer = ref(null);
let mermaidInstance = null;
let mermaidInitialized = false;

async function initMermaid() {
  if (mermaidInitialized) return mermaidInstance;
  const { default: mermaid } = await import('mermaid');
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    fontFamily: 'Inter, system-ui, sans-serif',
    flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
    sequence: { useMaxWidth: true },
    gantt: { useMaxWidth: true },
  });
  mermaidInstance = mermaid;
  mermaidInitialized = true;
  return mermaid;
}

marked.setOptions({
  gfm: true,
  breaks: true,
});

function renderMarkdownWithAnchors(md) {
  const renderer = new marked.Renderer();

  renderer.heading = ({ text, depth, raw }) => {
    const anchorMatch = raw.match(/^(.+?)\s*\{#([^}]+)\}$/);
    let cleanText = text;
    let customAnchor;
    if (anchorMatch) {
      cleanText = anchorMatch[1].trim();
      customAnchor = anchorMatch[2];
    }
    const id = customAnchor || text.toLowerCase().replace(/[^\w]+/g, '-').replace(/(^-|-$)/g, '');
    return `<h${depth} id="${id}"><a href="#${id}" class="heading-anchor">#</a>${cleanText}</h${depth}>`;
  };

  renderer.code = ({ text, lang }) => {
    if (lang === 'mermaid') {
      return `<div class="mermaid-placeholder" data-diagram="${encodeURIComponent(text)}"><div class="mermaid-loading"><div class="loading-spinner"></div><span>Rendering diagram...</span></div></div>`;
    }
    const langLabel = lang ? `<span class="code-lang">${lang}</span>` : '';
    return `<pre class="code-block">${langLabel}<code class="language-${lang || 'text'}">${escapeHtml(text)}</code></pre>`;
  };

  renderer.table = ({ header, rows }) => {
    const renderCells = cells => cells.map(c => `<td>${c.text ?? ''}</td>`).join('');
    const thead = `<tr>${header.map(c => `<th>${c.text ?? ''}</th>`).join('')}</tr>`;
    const tbody = rows.map(row => `<tr>${renderCells(row)}</tr>`).join('');
    return `<div class="table-wrapper"><table><thead>${thead}</thead><tbody>${tbody}</tbody></table></div>`;
  };

  renderer.link = ({ href, title, text }) => {
    if (href && href.startsWith('#')) {
      return `<a href="${href}" class="internal-link">${text}</a>`;
    }
    return `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
  };

  return marked.parse(md, { renderer });
}

function escapeHtml(str) {
  const s = typeof str === 'string' ? str : String(str ?? '');
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function renderMermaidDiagrams(containerEl) {
  if (!containerEl) return;
  const placeholders = containerEl.querySelectorAll('.mermaid-placeholder');
  if (!placeholders.length) return;

  const mermaid = await initMermaid();

  for (const placeholder of placeholders) {
    const diagramCode = decodeURIComponent(placeholder.dataset.diagram);
    const renderId = `mermaid-${Math.random().toString(36).slice(2, 9)}`;

    try {
      const { svg } = await mermaid.render(renderId, diagramCode);
      placeholder.outerHTML = `<div class="mermaid-diagram">${svg}</div>`;
      const svgEl = placeholder.parentElement?.querySelector('svg') || containerEl.querySelector(`#${renderId}`);
      if (svgEl) {
        svgEl.style.maxWidth = '100%';
        svgEl.style.height = 'auto';
      }
    } catch (err) {
      console.warn('Mermaid render failed:', err);
      placeholder.outerHTML = `<div class="mermaid-error"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg><span>Failed to render diagram: ${escapeHtml(err.message)}</span></div>`;
    }
  }
}

const renderedContent = computed(() => {
  if (!section.value?.content) return '';
  const md = typeof section.value.content === 'string'
    ? section.value.content
    : JSON.stringify(section.value.content);
  return renderMarkdownWithAnchors(md);
});

const diffHtml = computed(() => {
  if (!history.value.length || !showDiff.value) return null;
  const entry = history.value[diffIndex.value];
  if (!entry) return null;
  return {
    before: entry.contentBefore ? renderMarkdownWithAnchors(entry.contentBefore) : '<em>No previous content</em>',
    after: renderMarkdownWithAnchors(entry.contentAfter),
    reason: entry.changeReason,
    changedAt: entry.changedAt,
  };
});

onMounted(async () => {
  await loadSection();
});

watch(() => props.sectionKey, async () => {
  await loadSection();
});

watch(activeTab, async () => {
  if (activeTab.value === 'content') {
    await nextTick();
    await renderMermaidDiagrams(contentContainer.value);
  }
});

async function loadSection() {
  loading.value = true;
  try {
    const [sectionData, backlinksData, relatedData] = await Promise.all([
      wikiApi.getSection(props.sectionKey, props.wikiId, contentOffset.value, contentLimit.value),
      wikiApi.getBacklinks(props.sectionKey, props.wikiId).catch(() => ({ backlinks: [] })),
      wikiApi.getSection(props.sectionKey, props.wikiId).then(r => r.relatedSections || []).catch(() => []),
    ]);
    section.value = sectionData;
    backlinks.value = backlinksData.backlinks || [];
    related.value = relatedData;

    if (props.wikiId) {
      const historyData = await wikiApi.getHistory(props.sectionKey, props.wikiId, historyLimit.value).catch(() => ({ history: [] }));
      history.value = historyData.history || [];
    }
  } catch (err) {
    console.error('Failed to load section:', err);
  } finally {
    loading.value = false;
    await nextTick();
    await renderMermaidDiagrams(contentContainer.value);
  }
}

function loadMoreContent() {
  if (section.value?.hasMore) {
    contentOffset.value = section.value.nextOffset;
    loadSection();
  }
}

function navigateTo(key) {
  router.push({ name: 'section', params: { sectionKey: key }, query: props.wikiId ? { wikiId: props.wikiId } : {} });
}

function goBack() {
  router.back();
}
</script>

<template>
  <div v-if="loading" class="loading-view">
    <div class="loading-spinner" />
    <span>Loading section...</span>
  </div>
  <div v-else-if="!section" class="error-view">
    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
    </svg>
    <p>Section not found</p>
    <button class="back-btn" @click="goBack">Go Back</button>
  </div>
  <div v-else class="section-viewer">
    <div class="viewer-header">
      <div class="header-left">
        <button class="back-btn" @click="goBack">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back
        </button>
        <div class="viewer-title-area">
          <h2>{{ section.title }}</h2>
          <div class="viewer-meta">
            <span class="meta-tag key">{{ section.key }}</span>
            <span class="meta-tag wiki">{{ section.wikiId }}</span>
            <span class="meta-tag parent">{{ section.parent }}</span>
            <span v-if="section.source" class="meta-tag source">{{ section.source }}</span>
          </div>
        </div>
      </div>
      <div class="header-right">
        <span class="content-size">{{ section.totalLength?.toLocaleString() }} chars</span>
      </div>
    </div>

    <div class="viewer-tabs">
      <button
        v-for="tab in ['content', 'backlinks', 'history', 'metadata']"
        :key="tab"
        :class="['tab-btn', { active: activeTab === tab }]"
        @click="activeTab = tab"
      >
        <svg v-if="tab === 'content'" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
        <svg v-else-if="tab === 'backlinks'" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        <svg v-else-if="tab === 'history'" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        <svg v-else viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        {{ tab.charAt(0).toUpperCase() + tab.slice(1) }}
        <span v-if="tab === 'backlinks'" class="tab-count">({{ backlinks.length }})</span>
        <span v-if="tab === 'history'" class="tab-count">({{ history.length }})</span>
      </button>
    </div>

    <div class="viewer-body">
      <div v-show="activeTab === 'content'" class="content-tab">
        <div ref="contentContainer" class="markdown-body" v-html="renderedContent" />
        <button v-if="section.hasMore" class="load-more-btn" @click="loadMoreContent">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          Load more ({{ (section.totalLength - contentOffset).toLocaleString() }} chars remaining)
        </button>

        <div v-if="related.length" class="related-section">
          <h4>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            Related Sections
          </h4>
          <ul class="related-list">
            <li v-for="r in related" :key="r.key">
              <a href="#" @click.prevent="navigateTo(r.key)">{{ r.title }}</a>
            </li>
          </ul>
        </div>
      </div>

      <div v-show="activeTab === 'backlinks'" class="backlinks-tab">
        <h4 class="tab-title">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          Incoming Links ({{ backlinks.length }})
        </h4>
        <ul v-if="backlinks.length" class="link-list">
          <li v-for="bl in backlinks" :key="bl.key" class="link-card">
            <a href="#" @click.prevent="navigateTo(bl.key)">
              <div class="link-icon">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
              </div>
              <div class="link-info">
                <span class="link-title">{{ bl.title }}</span>
                <span class="link-parent">{{ bl.parent }}</span>
              </div>
              <svg class="link-arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
            </a>
          </li>
        </ul>
        <div v-else class="empty-state">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 15s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/></svg>
          <p>No sections link to this one</p>
        </div>
      </div>

      <div v-show="activeTab === 'history'" class="history-tab">
        <div v-if="!history.length" class="empty-state">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <p>No edit history available</p>
        </div>
        <template v-else>
          <div class="history-controls">
            <label class="toggle-label">
              <input type="checkbox" v-model="showDiff" />
              <span class="toggle-track"><span class="toggle-thumb" /></span>
              Show diff view
            </label>
          </div>

          <div v-if="showDiff && diffHtml" class="diff-viewer">
            <div class="diff-header">
              <span class="diff-date">{{ new Date(diffHtml.changedAt).toLocaleString() }}</span>
              <span v-if="diffHtml.reason" class="diff-reason">{{ diffHtml.reason }}</span>
            </div>
            <div class="diff-columns">
              <div class="diff-col before">
                <h5>Before</h5>
                <div v-html="diffHtml.before" />
              </div>
              <div class="diff-col after">
                <h5>After</h5>
                <div v-html="diffHtml.after" />
              </div>
            </div>
          </div>

          <div class="history-timeline">
            <div v-for="(entry, idx) in history" :key="idx" class="timeline-entry">
              <div class="timeline-line">
                <div class="timeline-dot" />
              </div>
              <div class="timeline-content">
                <div class="timeline-header">
                  <span class="timeline-date">{{ new Date(entry.changedAt).toLocaleString() }}</span>
                  <span v-if="entry.changeReason" class="timeline-reason">{{ entry.changeReason }}</span>
                </div>
                <button class="diff-toggle" @click="showDiff = true; diffIndex = idx">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  View Diff
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>

      <div v-show="activeTab === 'metadata'" class="metadata-tab">
        <div class="metadata-card">
          <h4>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Technical Metadata
          </h4>
          <dl class="metadata-list">
            <div class="meta-row">
              <dt>Key</dt>
              <dd><code class="meta-code">{{ section.key }}</code></dd>
            </div>
            <div class="meta-row">
              <dt>Title</dt>
              <dd>{{ section.title }}</dd>
            </div>
            <div class="meta-row">
              <dt>Wiki ID</dt>
              <dd><span class="meta-tag wiki">{{ section.wikiId }}</span></dd>
            </div>
            <div class="meta-row">
              <dt>Parent</dt>
              <dd>{{ section.parent }}</dd>
            </div>
            <div class="meta-row">
              <dt>Content Length</dt>
              <dd>{{ section.totalLength?.toLocaleString() }} characters</dd>
            </div>
            <div class="meta-row">
              <dt>Source File</dt>
              <dd><code class="meta-code">{{ section.source || 'N/A' }}</code></dd>
            </div>
            <div class="meta-row">
              <dt>Breadcrumbs</dt>
              <dd>
                <div class="breadcrumb-tags">
                  <span v-for="(crumb, idx) in section.breadcrumbs" :key="idx" class="breadcrumb-tag">
                    {{ crumb }}
                  </span>
                  <span v-if="!section.breadcrumbs.length" class="text-muted">None</span>
                </div>
              </dd>
            </div>
            <div class="meta-row">
              <dt>Offset</dt>
              <dd>{{ contentOffset.toLocaleString() }} / {{ section.totalLength?.toLocaleString() }}</dd>
            </div>
            <div class="meta-row">
              <dt>Has More</dt>
              <dd>
                <span :class="['status-badge', section.hasMore ? 'status-yes' : 'status-no']">
                  {{ section.hasMore ? 'Yes' : 'No' }}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.loading-view, .error-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: var(--text-muted);
  font-size: 14px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-view svg {
  opacity: 0.3;
}

.viewer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-elevated);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
  min-width: 0;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: var(--transition);
  flex-shrink: 0;
}

.back-btn:hover {
  background: var(--accent-bg);
  color: var(--accent);
  border-color: var(--accent-border);
}

.viewer-title-area {
  flex: 1;
  min-width: 0;
}

.viewer-title-area h2 {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 6px;
  color: var(--text-h);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.viewer-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.meta-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.meta-tag.key {
  color: var(--accent);
  background: var(--accent-bg);
  font-family: var(--mono);
}

.meta-tag.wiki {
  color: var(--text-muted);
  background: var(--bg);
  border: 1px solid var(--border);
}

.meta-tag.parent {
  color: var(--text);
  background: var(--bg);
  border: 1px solid var(--border);
}

.meta-tag.source {
  color: var(--text-muted);
  background: var(--code-bg);
  font-family: var(--mono);
}

.header-right {
  flex-shrink: 0;
}

.content-size {
  font-size: 12px;
  color: var(--text-muted);
  font-family: var(--mono);
  font-weight: 500;
  padding: 6px 12px;
  background: var(--bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
}

.viewer-tabs {
  display: flex;
  padding: 0 20px;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-elevated);
  gap: 2px;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  border-bottom: 2px solid transparent;
  transition: var(--transition);
}

.tab-btn:hover {
  color: var(--text-h);
}

.tab-btn.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.tab-count {
  font-size: 11px;
  color: var(--text-muted);
}

.viewer-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.content-tab :deep(.markdown-body) {
  line-height: 1.7;
  color: var(--text);
  font-size: 14px;
  max-width: 800px;
}

.content-tab :deep(.markdown-body h1),
.content-tab :deep(.markdown-body h2),
.content-tab :deep(.markdown-body h3),
.content-tab :deep(.markdown-body h4),
.content-tab :deep(.markdown-body h5),
.content-tab :deep(.markdown-body h6) {
  color: var(--text-h);
  margin-top: 28px;
  margin-bottom: 12px;
  font-weight: 600;
  line-height: 1.3;
}

.content-tab :deep(.markdown-body h1) { font-size: 24px; border-bottom: 1px solid var(--border); padding-bottom: 8px; }
.content-tab :deep(.markdown-body h2) { font-size: 20px; border-bottom: 1px solid var(--border); padding-bottom: 6px; }
.content-tab :deep(.markdown-body h3) { font-size: 17px; }
.content-tab :deep(.markdown-body h4) { font-size: 15px; }

.content-tab :deep(.markdown-body h1:first-child),
.content-tab :deep(.markdown-body h2:first-child),
.content-tab :deep(.markdown-body h3:first-child) {
  margin-top: 0;
}

.content-tab :deep(.heading-anchor) {
  color: var(--accent);
  text-decoration: none;
  opacity: 0;
  margin-left: 6px;
  font-weight: 400;
  transition: opacity 0.15s;
}

.content-tab :deep(h1:hover .heading-anchor),
.content-tab :deep(h2:hover .heading-anchor),
.content-tab :deep(h3:hover .heading-anchor),
.content-tab :deep(h4:hover .heading-anchor) {
  opacity: 1;
}

.content-tab :deep(.markdown-body p) {
  margin: 0 0 12px;
}

.content-tab :deep(.markdown-body ul),
.content-tab :deep(.markdown-body ol) {
  padding-left: 24px;
  margin: 0 0 12px;
}

.content-tab :deep(.markdown-body li) {
  margin-bottom: 4px;
}

.content-tab :deep(.markdown-body li > input[type="checkbox"]) {
  margin-right: 6px;
}

.content-tab :deep(.markdown-body blockquote) {
  margin: 0 0 12px;
  padding: 8px 16px;
  border-left: 4px solid var(--accent);
  background: var(--accent-bg);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  color: var(--text);
}

.content-tab :deep(.markdown-body blockquote p:last-child) {
  margin-bottom: 0;
}

.content-tab :deep(.markdown-body code) {
  background: var(--code-bg);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--mono);
  font-size: 13px;
  color: var(--text-h);
}

.content-tab :deep(.markdown-body .code-block) {
  position: relative;
  background: var(--code-bg);
  padding: 16px;
  padding-top: 32px;
  border-radius: var(--radius-md);
  overflow-x: auto;
  margin: 0 0 16px;
  border: 1px solid var(--border);
}

.content-tab :deep(.markdown-body .code-lang) {
  position: absolute;
  top: 8px;
  right: 12px;
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--mono);
  text-transform: uppercase;
}

.content-tab :deep(.markdown-body .code-block code) {
  background: none;
  padding: 0;
  font-size: 13px;
  line-height: 1.5;
}

.content-tab :deep(.markdown-body pre) {
  background: var(--code-bg);
  padding: 12px;
  border-radius: var(--radius-md);
  overflow-x: auto;
  margin: 0 0 12px;
}

.content-tab :deep(.markdown-body .table-wrapper) {
  overflow-x: auto;
  margin: 0 0 16px;
}

.content-tab :deep(.markdown-body table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.content-tab :deep(.markdown-body th),
.content-tab :deep(.markdown-body td) {
  padding: 8px 12px;
  border: 1px solid var(--border);
  text-align: left;
}

.content-tab :deep(.markdown-body th) {
  background: var(--code-bg);
  font-weight: 600;
  color: var(--text-h);
}

.content-tab :deep(.markdown-body tr:nth-child(even)) {
  background: var(--code-bg);
}

.content-tab :deep(.markdown-body hr) {
  border: none;
  border-top: 1px solid var(--border);
  margin: 24px 0;
}

.content-tab :deep(.markdown-body img) {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-md);
}

.content-tab :deep(.markdown-body a) {
  color: var(--accent);
}

.content-tab :deep(.markdown-body .internal-link) {
  color: var(--accent);
  text-decoration: underline;
  text-decoration-style: dotted;
}

.content-tab :deep(.mermaid-diagram) {
  margin: 16px 0;
  padding: 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow-x: auto;
  display: flex;
  justify-content: center;
}

.content-tab :deep(.mermaid-diagram svg) {
  max-width: 100%;
  height: auto;
}

.content-tab :deep(.mermaid-loading) {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  color: var(--text-muted);
  font-size: 13px;
}

.content-tab :deep(.mermaid-loading .loading-spinner) {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.content-tab :deep(.mermaid-error) {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--danger-bg);
  color: var(--danger);
  font-size: 13px;
  border-radius: var(--radius-sm);
  margin: 16px 0;
}

.load-more-btn {
  margin-top: 20px;
  padding: 10px 18px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: var(--transition);
}

.load-more-btn:hover {
  background: var(--accent-bg);
  color: var(--accent);
  border-color: var(--accent-border);
}

.related-section {
  margin-top: 32px;
  padding-top: 20px;
  border-top: 1px solid var(--border-light);
}

.related-section h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-h);
  margin: 0 0 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.related-section h4 svg {
  color: var(--accent);
}

.related-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.related-list li a {
  display: inline-block;
  padding: 6px 14px;
  background: var(--accent-bg);
  color: var(--accent);
  border-radius: 20px;
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  transition: var(--transition);
  border: 1px solid transparent;
}

.related-list li a:hover {
  background: var(--accent);
  color: white;
  text-decoration: none;
}

.tab-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-h);
  margin: 0 0 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tab-title svg {
  color: var(--accent);
}

.link-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.link-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: var(--transition);
}

.link-card:hover {
  border-color: var(--accent-border);
  box-shadow: var(--shadow-sm);
}

.link-card a {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  text-decoration: none;
}

.link-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-bg);
  color: var(--accent);
  border-radius: var(--radius-md);
  flex-shrink: 0;
}

.link-info {
  flex: 1;
  min-width: 0;
}

.link-title {
  font-size: 14px;
  color: var(--text-h);
  font-weight: 500;
  display: block;
}

.link-parent {
  font-size: 12px;
  color: var(--text-muted);
}

.link-arrow {
  color: var(--text-muted);
  flex-shrink: 0;
  transition: var(--transition);
}

.link-card:hover .link-arrow {
  color: var(--accent);
  transform: translateX(2px);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 48px 20px;
  color: var(--text-muted);
  font-size: 14px;
}

.empty-state svg {
  opacity: 0.3;
}

.history-controls {
  margin-bottom: 16px;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--text);
  cursor: pointer;
  user-select: none;
}

.toggle-label input {
  display: none;
}

.toggle-track {
  width: 36px;
  height: 20px;
  background: var(--border);
  border-radius: 10px;
  position: relative;
  transition: var(--transition);
}

.toggle-thumb {
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: var(--transition);
  box-shadow: var(--shadow-sm);
}

.toggle-label input:checked + .toggle-track {
  background: var(--accent);
}

.toggle-label input:checked + .toggle-track .toggle-thumb {
  transform: translateX(16px);
}

.diff-viewer {
  margin-bottom: 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--bg-elevated);
}

.diff-header {
  display: flex;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--code-bg);
  font-size: 12px;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
}

.diff-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
}

.diff-col {
  padding: 16px;
}

.diff-col.before {
  border-right: 1px solid var(--border);
}

.diff-col h5 {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--text-h);
  font-weight: 600;
}

.history-timeline {
  display: flex;
  flex-direction: column;
}

.timeline-entry {
  display: flex;
  gap: 14px;
  padding: 12px 0;
}

.timeline-line {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}

.timeline-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
  margin-top: 4px;
}

.timeline-content {
  flex: 1;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-light);
}

.timeline-header {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.timeline-date {
  font-size: 13px;
  color: var(--text-h);
  font-weight: 500;
}

.timeline-reason {
  font-size: 12px;
  color: var(--text-muted);
  background: var(--bg);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--border);
}

.diff-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: var(--transition);
}

.diff-toggle:hover {
  background: var(--accent-bg);
  color: var(--accent);
  border-color: var(--accent-border);
}

.metadata-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
}

.metadata-card h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-h);
  margin: 0 0 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.metadata-card h4 svg {
  color: var(--accent);
}

.metadata-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.meta-row {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-light);
}

.meta-row:last-child {
  border-bottom: none;
}

.meta-row dt {
  color: var(--text-muted);
  font-weight: 500;
  font-size: 13px;
}

.meta-row dd {
  margin: 0;
  color: var(--text-h);
  font-size: 13px;
}

.meta-code {
  font-family: var(--mono);
  font-size: 12px;
  background: var(--code-bg);
  padding: 3px 8px;
  border-radius: 4px;
  color: var(--accent);
}

.breadcrumb-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.breadcrumb-tag {
  display: inline-block;
  padding: 3px 10px;
  background: var(--accent-bg);
  color: var(--accent);
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.text-muted {
  color: var(--text-muted);
  font-style: italic;
}

.status-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.status-yes {
  background: var(--success-bg);
  color: var(--success);
}

.status-no {
  background: var(--bg);
  color: var(--text-muted);
  border: 1px solid var(--border);
}
</style>
