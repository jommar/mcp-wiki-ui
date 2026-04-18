<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { wikiApi } from '../api/wiki.js';

const props = defineProps({ wikiId: String });
const router = useRouter();

const groups = ref([]);
const loading = ref(true);
const expandedParents = ref(new Set());
const searchFilter = ref('');

const filteredGroups = computed(() => {
  if (!searchFilter.value) return groups.value;
  const term = searchFilter.value.toLowerCase();
  return groups.value
    .map(g => ({
      ...g,
      sections: g.sections.filter(s =>
        s.title.toLowerCase().includes(term) || s.key.toLowerCase().includes(term)
      ),
    }))
    .filter(g => g.sections.length > 0);
});

onMounted(async () => {
  await loadData();
});

watch(() => props.wikiId, async () => {
  await loadData();
});

async function loadData() {
  loading.value = true;
  try {
    const data = await wikiApi.browse(null, props.wikiId, 1000);
    groups.value = data.groups || [];
    groups.value.forEach(g => expandedParents.add(g.parent));
  } catch (err) {
    console.error('Failed to load topics:', err);
  } finally {
    loading.value = false;
  }
}

function toggleParent(parent) {
  if (expandedParents.value.has(parent)) {
    expandedParents.value.delete(parent);
  } else {
    expandedParents.value.add(parent);
  }
  expandedParents.value = new Set(expandedParents.value);
}

function expandAll() {
  groups.value.forEach(g => expandedParents.value.add(g.parent));
  expandedParents.value = new Set(expandedParents.value);
}

function collapseAll() {
  expandedParents.value.clear();
  expandedParents.value = new Set();
}

function navigateTo(key) {
  router.push({ name: 'section', params: { sectionKey: key }, query: props.wikiId ? { wikiId: props.wikiId } : {} });
}

function getDepthClass(depth) {
  if (depth <= 2) return 'depth-h2';
  if (depth === 3) return 'depth-h3';
  return 'depth-h4';
}
</script>

<template>
  <div class="topic-tree">
    <div class="tree-header">
      <div class="header-content">
        <h2>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>
          </svg>
          Topic Hierarchy
        </h2>
        <p class="header-desc">Browse wiki sections organized by topic</p>
      </div>
      <div class="tree-controls">
        <div class="search-wrapper">
          <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            v-model="searchFilter"
            type="text"
            placeholder="Filter topics..."
            class="tree-filter"
          />
        </div>
        <button class="control-btn" @click="expandAll">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 10l5 5 5-5"/></svg>
          Expand
        </button>
        <button class="control-btn" @click="collapseAll">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 14l5-5 5 5"/></svg>
          Collapse
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="loading-spinner" />
      <span>Loading topics...</span>
    </div>

    <div v-else class="tree-content">
      <div class="tree-stats">
        <span class="stat-pill">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          {{ groups.length }} groups
        </span>
        <span class="stat-pill">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
          {{ groups.reduce((sum, g) => sum + g.sections.length, 0) }} sections
        </span>
      </div>

      <div class="tree-list">
        <div v-for="group in filteredGroups" :key="group.parent" class="tree-group">
          <div class="group-header" @click="toggleParent(group.parent)">
            <span class="group-toggle">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"
                :class="{ 'toggle-open': expandedParents.has(group.parent) }">
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </span>
            <span class="group-name">{{ group.parent }}</span>
            <span class="group-count">{{ group.sections.length }}</span>
          </div>

          <transition name="expand">
            <div v-show="expandedParents.has(group.parent)" class="group-children">
              <div
                v-for="section in group.sections"
                :key="section.key"
                :class="['section-item', getDepthClass(section.depth)]"
                @click="navigateTo(section.key)"
              >
                <span class="section-icon">
                  <svg v-if="section.depth <= 2" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>
                  </svg>
                  <svg v-else viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/>
                  </svg>
                </span>
                <span class="section-title">{{ section.title }}</span>
                <span class="section-key">{{ section.key }}</span>
              </div>
            </div>
          </transition>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.topic-tree {
  padding: 24px;
  height: 100%;
  overflow-y: auto;
}

.tree-header {
  margin-bottom: 20px;
}

.header-content {
  margin-bottom: 16px;
}

.header-content h2 {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-h);
  margin: 0 0 6px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-content h2 svg {
  color: var(--accent);
}

.header-desc {
  font-size: 14px;
  color: var(--text-muted);
  margin: 0;
}

.tree-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 10px;
  width: 14px;
  height: 14px;
  color: var(--text-muted);
  pointer-events: none;
}

.tree-filter {
  padding: 8px 10px 8px 32px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
  color: var(--text);
  font-size: 13px;
  width: 200px;
  transition: var(--transition);
}

.tree-filter:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-bg);
}

.control-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: var(--transition);
}

.control-btn:hover {
  background: var(--accent-bg);
  color: var(--accent);
  border-color: var(--accent-border);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 0;
  color: var(--text-muted);
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

.tree-stats {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}

.stat-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
  background: var(--bg-elevated);
  padding: 6px 12px;
  border-radius: 20px;
  border: 1px solid var(--border);
  font-weight: 500;
}

.stat-pill svg {
  color: var(--accent);
}

.tree-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tree-group {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-elevated);
  transition: var(--transition);
}

.tree-group:hover {
  border-color: var(--accent-border);
}

.group-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: var(--bg);
  cursor: pointer;
  user-select: none;
  transition: var(--transition);
}

.group-header:hover {
  background: var(--accent-bg);
}

.group-toggle {
  display: flex;
  color: var(--text-muted);
  transition: transform 0.2s;
}

.toggle-open {
  transform: rotate(180deg);
}

.group-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-h);
  flex: 1;
}

.group-count {
  font-size: 12px;
  color: var(--text-muted);
  background: var(--bg-elevated);
  padding: 2px 10px;
  border-radius: 10px;
  border: 1px solid var(--border);
  font-weight: 600;
  font-family: var(--mono);
}

.group-children {
  padding: 4px 0;
}

.section-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px 8px 40px;
  cursor: pointer;
  transition: var(--transition);
}

.section-item:hover {
  background: var(--accent-bg);
}

.depth-h3 .section-item {
  padding-left: 56px;
}

.depth-h4 .section-item {
  padding-left: 72px;
}

.section-icon {
  display: flex;
  color: var(--text-muted);
  flex-shrink: 0;
}

.section-title {
  font-size: 13px;
  color: var(--text-h);
  flex: 1;
  font-weight: 500;
}

.section-key {
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--mono);
  opacity: 0.6;
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.25s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 2000px;
}
</style>
