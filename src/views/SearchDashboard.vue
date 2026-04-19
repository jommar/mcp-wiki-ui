<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { wikiApi } from '../api/wiki.js';

const props = defineProps({ wikiId: String });
const router = useRouter();

const searchQuery = ref('');
const results = ref([]);
const loading = ref(false);
const hasSearched = ref(false);

const maxRank = computed(() => {
  if (!results.value.length) return 1;
  return Math.max(...results.value.map((r) => r.rank || 0), 1);
});

const rankDistribution = computed(() => {
  const buckets = [0, 0, 0, 0, 0];
  results.value.forEach((r) => {
    const normalized = (r.rank || 0) / maxRank.value;
    const idx = Math.min(4, Math.floor(normalized * 5));
    buckets[idx]++;
  });
  return buckets;
});

const rankLabels = ['Low', 'Low-Mid', 'Mid', 'Mid-High', 'High'];

async function performSearch() {
  if (!searchQuery.value.trim()) return;
  loading.value = true;
  hasSearched.value = true;
  try {
    const data = await wikiApi.search(searchQuery.value, props.wikiId, false, 50);
    results.value = data.results || [];
  } catch (err) {
    console.error('Search failed:', err);
    results.value = [];
  } finally {
    loading.value = false;
  }
}

function navigateTo(key) {
  router.push({
    name: 'section',
    params: { sectionKey: key },
    query: props.wikiId ? { wikiId: props.wikiId } : {},
  });
}

function onKeydown(e) {
  if (e.key === 'Enter') performSearch();
}
</script>

<template>
  <div class="search-dashboard">
    <div class="search-header">
      <div class="header-content">
        <h2>
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          Search Explorer
        </h2>
        <p class="header-desc">Find wiki sections by keyword or topic</p>
        <div v-if="wikiId" class="wiki-indicator">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <span class="wiki-id">{{ wikiId }}</span>
        </div>
      </div>
      <div class="search-bar">
        <svg
          class="search-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search wiki sections..."
          class="search-input"
          @keydown="onKeydown"
        />
        <button class="search-btn" :disabled="loading" @click="performSearch">
          <svg
            v-if="loading"
            class="btn-spinner"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <template v-else> Search </template>
        </button>
      </div>
    </div>

    <div v-if="hasSearched && results.length" class="search-results">
      <div class="results-summary">
        <span class="result-count">
          <span class="count-badge">{{ results.length }}</span>
          results found
        </span>
        <div class="rank-distribution">
          <span class="dist-label">Rank:</span>
          <div class="dist-bars">
            <div v-for="(count, idx) in rankDistribution" :key="idx" class="dist-bar-wrapper">
              <div
                class="dist-bar"
                :style="{ height: `${Math.max(8, (count / results.length) * 60)}px` }"
                :title="`${rankLabels[idx]}: ${count}`"
              />
              <span class="dist-bar-label">{{ rankLabels[idx] }}</span>
              <span class="dist-bar-count">{{ count }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="results-list">
        <div v-for="(result, idx) in results" :key="result.key" class="result-card">
          <div class="result-rank">
            <span class="rank-badge">#{{ idx + 1 }}</span>
            <span v-if="result.rank" class="rank-score">{{ result.rank.toFixed(3) }}</span>
          </div>
          <div class="result-info">
            <a href="#" class="result-title" @click.prevent="navigateTo(result.key)">
              {{ result.title }}
            </a>
            <div class="result-meta">
              <span class="result-key">{{ result.key }}</span>
              <span class="result-parent">{{ result.parent }}</span>
              <span v-if="result.contentLength" class="result-length"
                >{{ result.contentLength.toLocaleString() }} chars</span
              >
            </div>
            <p v-if="result.snippet" class="result-snippet">
              {{ result.snippet }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="hasSearched && !results.length" class="no-results">
      <svg
        viewBox="0 0 24 24"
        width="48"
        height="48"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.35-4.35" />
        <path d="M8 11h6" />
      </svg>
      <p>No results found for "{{ searchQuery }}"</p>
    </div>

    <div v-else class="search-placeholder">
      <svg
        viewBox="0 0 24 24"
        width="64"
        height="64"
        fill="none"
        stroke="currentColor"
        stroke-width="1"
        opacity="0.3"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
        <path d="M11 8v6M8 11h6" />
      </svg>
      <p>Enter a search query to explore wiki content</p>
    </div>
  </div>
</template>

<style scoped>
.search-dashboard {
  padding: 24px;
  height: 100%;
  overflow-y: auto;
}

.search-header {
  margin-bottom: 24px;
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

.wiki-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 4px 10px;
  background: var(--accent-bg);
  border-radius: 20px;
  font-size: 12px;
  color: var(--accent);
}

.wiki-indicator svg {
  opacity: 0.7;
}

.wiki-id {
  font-family: var(--mono);
  font-weight: 600;
}

.search-bar {
  display: flex;
  gap: 10px;
  align-items: center;
  position: relative;
}

.search-icon {
  position: absolute;
  left: 14px;
  width: 18px;
  height: 18px;
  color: var(--text-muted);
  pointer-events: none;
}

.search-input {
  flex: 1;
  padding: 12px 14px 12px 42px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
  color: var(--text);
  font-size: 14px;
  transition: var(--transition);
  box-shadow: var(--shadow-sm);
}

.search-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow:
    0 0 0 3px var(--accent-bg),
    var(--shadow-sm);
}

.search-input::placeholder {
  color: var(--text-muted);
}

.search-btn {
  padding: 12px 24px;
  border: none;
  background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
  color: white;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: var(--transition);
  box-shadow: var(--shadow-sm);
  white-space: nowrap;
}

.search-btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.search-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.btn-spinner {
  width: 16px;
  height: 16px;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.results-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  margin-bottom: 16px;
}

.result-count {
  font-size: 14px;
  color: var(--text);
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
}

.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 8px;
  background: var(--accent-bg);
  color: var(--accent);
  border-radius: 20px;
  font-weight: 700;
  font-size: 14px;
}

.rank-distribution {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dist-label {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
}

.dist-bars {
  display: flex;
  align-items: flex-end;
  gap: 4px;
}

.dist-bar-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.dist-bar {
  width: 20px;
  background: linear-gradient(180deg, var(--gradient-start), var(--gradient-end));
  border-radius: 3px 3px 0 0;
  min-height: 6px;
  transition: height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.dist-bar-label {
  font-size: 9px;
  color: var(--text-muted);
}

.dist-bar-count {
  font-size: 10px;
  color: var(--text-h);
  font-weight: 600;
  font-family: var(--mono);
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-card {
  display: flex;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
  transition: var(--transition);
  border-left: 3px solid var(--accent);
}

.result-card:hover {
  border-color: var(--accent-border);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.result-rank {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 50px;
}

.rank-badge {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-h);
}

.rank-score {
  font-size: 11px;
  color: var(--accent);
  font-family: var(--mono);
  font-weight: 500;
}

.result-info {
  flex: 1;
}

.result-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-h);
  text-decoration: none;
  transition: var(--transition);
}

.result-title:hover {
  color: var(--accent);
}

.result-meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
  flex-wrap: wrap;
}

.result-key {
  font-family: var(--mono);
  color: var(--accent);
  background: var(--accent-bg);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
}

.result-snippet {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--text);
  line-height: 1.5;
  padding: 8px 12px;
  background: var(--bg);
  border-radius: var(--radius-sm);
  border-left: 2px solid var(--border);
}

.no-results,
.search-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  color: var(--text-muted);
  font-size: 14px;
}

.no-results svg,
.search-placeholder svg {
  opacity: 0.2;
}
</style>
