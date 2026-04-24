<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { wikiApi } from '../api/wiki.js';
import { marked } from 'marked';
import CopyLinksButton from './CopyLinksButton.vue';
import { Sun, X, Frown, Check, Copy, ArrowUp, ArrowDown, ChevronRight } from 'lucide-vue-next';

const props = defineProps({
  wikiId: String,
  sectionKey: String,
  keys: { type: Array, default: null },
  autoOpen: { type: Boolean, default: false },
  label: { type: String, default: 'View Connections' },
});

onMounted(() => {
  if (props.autoOpen) openModal();
});

const router = useRouter();
const route = useRoute();

const open = ref(false);
const loading = ref(false);
const sections = ref([]);
const copiedKey = ref(null);
let copiedTimeout = null;

async function copySection(section) {
  const text = section.content?.startsWith('#')
    ? section.content
    : `# ${section.title}\n\n${section.content}`;
  await navigator.clipboard.writeText(text);
  copiedKey.value = section.key;
  if (copiedTimeout) clearTimeout(copiedTimeout);
  copiedTimeout = setTimeout(() => { copiedKey.value = null; }, 2000);
}

marked.setOptions({ gfm: true, breaks: true });

function renderMd(content) {
  if (!content) return '';
  const s = typeof content === 'string' ? content : JSON.stringify(content);
  return marked.parse(s);
}

async function openModal() {
  open.value = true;
  loading.value = true;
  sections.value = [];
  try {
    if (props.keys && props.keys.length > 0) {
      // Fetch sections directly by key
      const data = await wikiApi.getSectionsBatch(props.keys, props.wikiId);
      sections.value = (data.sections || []).map((s) => ({ ...s, direction: null }));
    } else {
      // Fetch incoming/outgoing connections
      const [inData, outData] = await Promise.all([
        wikiApi.getLinksContent(props.sectionKey, props.wikiId, { incoming: true, outgoing: false }),
        wikiApi.getLinksContent(props.sectionKey, props.wikiId, { incoming: false, outgoing: true }),
      ]);
      const map = new Map();
      for (const s of inData.sections || []) map.set(s.key, { ...s, direction: 'incoming' });
      for (const s of outData.sections || []) {
        if (map.has(s.key)) map.get(s.key).direction = 'both';
        else map.set(s.key, { ...s, direction: 'outgoing' });
      }
      sections.value = [...map.values()];
    }
  } catch (err) {
    console.error('Failed to load connected sections:', err);
  } finally {
    loading.value = false;
  }
}

function close() {
  open.value = false;
}

function navigateTo(key) {
  router.push({
    name: 'section',
    params: { sectionKey: key },
    query: { ...route.query, wikiId: props.wikiId },
  });
  close();
}

function onOverlayKeydown(e) {
  if (e.key === 'Escape') close();
}
</script>

<template>
  <button class="view-connections-btn" @click="openModal">
    <Sun :width="16" :height="16" fill="none" stroke="currentColor" :stroke-width="2" />
    {{ label }}
  </button>

  <Teleport to="body">
    <div
      v-if="open"
      class="modal-overlay"
      tabindex="-1"
      @click.self="close"
      @keydown="onOverlayKeydown"
    >
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h3>Connected Sections</h3>
          <div class="modal-header-actions">
            <CopyLinksButton
              :wiki-id="wikiId"
              :section-key="sectionKey"
              :keys="keys"
              :incoming="true"
              :outgoing="true"
              label="Copy All"
            />
            <button class="close-btn" aria-label="Close" @click="close">
              <X :width="18" :height="18" fill="none" stroke="currentColor" :stroke-width="2" />
            </button>
          </div>
        </div>

        <div v-if="loading" class="modal-loading">
          <div class="loading-spinner" />
          <span>Loading connected sections…</span>
        </div>

        <template v-else>
          <div class="modal-body">
            <div v-if="!sections.length" class="empty-state">
              <Frown :width="28" :height="28" fill="none" stroke="currentColor" :stroke-width="1.5" />
              <p>No connections</p>
            </div>

            <div v-for="section in sections" :key="section.key + section.direction" class="section-card">
              <div class="section-card-header">
                <div class="section-card-meta">
                  <span class="section-card-title">{{ section.title }}</span>
                  <span class="section-card-key">{{ section.key }}</span>
                </div>
                <div class="section-card-actions">
                  <button class="copy-section-btn" @click="copySection(section)">
                    <Check v-if="copiedKey === section.key" :width="13" :height="13" fill="none" stroke="currentColor" :stroke-width="2.5" />
                    <Copy v-else :width="13" :height="13" fill="none" stroke="currentColor" :stroke-width="2" />
                  </button>
                  <span v-if="section.direction" :class="['direction-badge', section.direction]">
                    <template v-if="section.direction === 'both'">
                      <ArrowUp :width="11" :height="11" fill="none" stroke="currentColor" :stroke-width="2.5" />
                      <ArrowDown :width="11" :height="11" fill="none" stroke="currentColor" :stroke-width="2.5" />
                    </template>
                    <ArrowUp
                      v-else-if="section.direction === 'incoming'"
                      :width="11" :height="11" fill="none" stroke="currentColor" :stroke-width="2.5"
                    />
                    <ArrowDown
                      v-else
                      :width="11" :height="11" fill="none" stroke="currentColor" :stroke-width="2.5"
                    />
                    {{ section.direction }}
                  </span>
                  <button class="open-btn" @click="navigateTo(section.key)">
                    Open
                    <ChevronRight :width="13" :height="13" fill="none" stroke="currentColor" :stroke-width="2" />
                  </button>
                </div>
              </div>
              <div class="section-card-content markdown-body" v-html="renderMd(section.content)" />
            </div>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.view-connections-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--bg-elevated);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: var(--transition);
}

.view-connections-btn:hover {
  background: var(--accent-bg);
  color: var(--accent);
  border-color: var(--accent-border);
}

/* Modal overlay */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 24px;
}

.modal {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 860px;
  max-height: 82vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg, 0 20px 60px rgba(0, 0, 0, 0.3));
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-h);
}

.modal-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: var(--transition);
}

.close-btn:hover {
  background: var(--bg);
  color: var(--text-h);
}

/* Loading */
.modal-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 20px;
  color: var(--text-muted);
  font-size: 14px;
}

.loading-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Body */
.modal-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Empty */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 20px;
  color: var(--text-muted);
  font-size: 14px;
}

.empty-state svg {
  opacity: 0.3;
}

/* Section cards */
.section-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
}

.section-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  background: var(--bg);
  border-bottom: 1px solid var(--border-light);
}

.section-card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.direction-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.direction-badge.incoming {
  background: color-mix(in srgb, #cbd5e1 40%, transparent);
  color: #94a3b8;
}

.direction-badge.outgoing {
  background: color-mix(in srgb, #fbbf24 35%, transparent);
  color: #d97706;
}

.direction-badge.both {
  background: color-mix(in srgb, #fbbf24 20%, color-mix(in srgb, #cbd5e1 20%, transparent));
  color: var(--text-muted);
}

.section-card-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.section-card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-h);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.section-card-key {
  font-size: 11px;
  color: var(--accent);
  font-family: var(--mono);
}

.copy-section-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition);
  flex-shrink: 0;
}

.copy-section-btn:hover {
  background: var(--accent-bg);
  color: var(--accent);
  border-color: var(--accent-border);
}

.open-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  flex-shrink: 0;
  transition: var(--transition);
}

.open-btn:hover {
  background: var(--accent-bg);
  color: var(--accent);
  border-color: var(--accent-border);
}

/* Rendered markdown inside cards */
.section-card-content {
  padding: 14px 16px;
  font-size: 13px;
  line-height: 1.65;
  color: var(--text);
}

.section-card-content :deep(h1),
.section-card-content :deep(h2),
.section-card-content :deep(h3),
.section-card-content :deep(h4) {
  color: var(--text-h);
  font-weight: 600;
  margin: 12px 0 6px;
  line-height: 1.3;
}

.section-card-content :deep(h1:first-child),
.section-card-content :deep(h2:first-child),
.section-card-content :deep(h3:first-child) {
  margin-top: 0;
}

.section-card-content :deep(p) {
  margin: 0 0 10px;
}

.section-card-content :deep(p:last-child) {
  margin-bottom: 0;
}

.section-card-content :deep(ul),
.section-card-content :deep(ol) {
  padding-left: 20px;
  margin: 0 0 10px;
}

.section-card-content :deep(li) {
  margin-bottom: 3px;
}

.section-card-content :deep(code) {
  background: var(--code-bg);
  padding: 1px 5px;
  border-radius: 3px;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--text-h);
}

.section-card-content :deep(pre) {
  background: var(--code-bg);
  padding: 10px 12px;
  border-radius: var(--radius-md);
  overflow-x: auto;
  margin: 0 0 10px;
}

.section-card-content :deep(pre code) {
  background: none;
  padding: 0;
}

.section-card-content :deep(blockquote) {
  margin: 0 0 10px;
  padding: 6px 14px;
  border-left: 3px solid var(--accent);
  background: var(--accent-bg);
  color: var(--text);
}

.section-card-content :deep(a) {
  color: var(--accent);
}

.section-card-content :deep(hr) {
  border: none;
  border-top: 1px solid var(--border);
  margin: 12px 0;
}
</style>
