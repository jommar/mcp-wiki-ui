<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { wikiApi } from './api/wiki.js';
import { useNavigation } from './composables/useNavigation.js';
import GlobalSearch from './components/GlobalSearch.vue';

const router = useRouter();
const { pushBreadcrumb } = useNavigation();

const selectedWiki = ref('');
const wikis = ref([]);
const loading = ref(true);
const activeView = ref('graph');
const globalSearch = ref(null);

function handleSearchNavigate(key) {
  router.push({ name: 'section', params: { key }, query: { wikiId: selectedWiki.value } });
}

const views = [
  { id: 'graph', label: 'Knowledge Graph', icon: 'graph' },
  { id: 'search', label: 'Search', icon: 'search' },
  { id: 'topics', label: 'Topics', icon: 'topics' },
  { id: 'health', label: 'Health', icon: 'health' },
  { id: 'stats', label: 'Stats', icon: 'stats' },
];

onMounted(async () => {
  try {
    const info = await wikiApi.getInfo();
    wikis.value = info.wikis || [];
  } catch (err) {
    console.error('Failed to load wiki info:', err);
  } finally {
    loading.value = false;
  }
});

function selectView(viewId) {
  activeView.value = viewId;
  pushBreadcrumb(
    viewId.charAt(0).toUpperCase() + viewId.slice(1),
    { name: viewId },
    { replace: true },
  );
  router.push({ name: viewId, query: selectedWiki.value ? { wikiId: selectedWiki.value } : {} });
}

function onWikiChange() {
  router.push({ query: selectedWiki.value ? { wikiId: selectedWiki.value } : {} });
}
</script>

<template>
  <div class="app-layout">
    <header class="app-header">
      <div class="header-inner">
        <div class="header-left">
          <div class="logo-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3" />
              <path
                d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
              />
            </svg>
          </div>
          <div class="logo-text">
            <h1 class="app-title">Wiki Explorer</h1>
            <span class="app-subtitle">Knowledge Visualization</span>
          </div>
        </div>

        <nav class="view-nav">
          <button
            v-for="view in views"
            :key="view.id"
            :class="['nav-btn', { active: activeView === view.id }]"
            @click="selectView(view.id)"
          >
            <svg
              class="nav-icon-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <template v-if="view.icon === 'graph'">
                <circle cx="5" cy="6" r="2" />
                <circle cx="19" cy="6" r="2" />
                <circle cx="12" cy="18" r="2" />
                <path d="M7 7l4 9M17 7l-4 9M7 6h10" />
              </template>
              <template v-else-if="view.icon === 'search'">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.35-4.35" />
              </template>
              <template v-else-if="view.icon === 'topics'">
                <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
              </template>
              <template v-else-if="view.icon === 'health'">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </template>
              <template v-else-if="view.icon === 'stats'">
                <path d="M18 20V10M12 20V4M6 20v-6" />
              </template>
            </svg>
            <span class="nav-label">{{ view.label }}</span>
          </button>
        </nav>

        <div class="header-right">
          <button class="search-trigger" @click="globalSearch?.open()">
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <span>Search</span>
            <kbd>⌘K</kbd>
          </button>
          <select
            v-if="wikis.length > 1"
            v-model="selectedWiki"
            class="wiki-select"
            @change="onWikiChange"
          >
            <option value="">All Wikis</option>
            <option v-for="w in wikis" :key="w.wikiId" :value="w.wikiId">
              {{ w.wikiId }}
            </option>
          </select>
        </div>
        <GlobalSearch ref="globalSearch" :wiki-id="selectedWiki" @navigate="handleSearchNavigate" />
      </div>
    </header>

    <main class="app-main">
      <router-view v-if="!loading" :wiki-id="selectedWiki" />
      <div v-else class="loading-state">
        <div class="loading-spinner" />
        <span>Loading wiki data...</span>
      </div>
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: var(--bg);
}

.app-header {
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  position: relative;
  z-index: 100;
}

@media (prefers-color-scheme: dark) {
  .app-header {
    background: var(--glass-bg);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border-bottom: 1px solid var(--glass-border);
  }
}

.app-header::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  opacity: 0.4;
}

.header-inner {
  display: flex;
  align-items: center;
  padding: 0 20px;
  height: 60px;
  gap: 24px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.logo-mark {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
  border-radius: var(--radius-md);
  color: white;
}

.logo-mark svg {
  width: 20px;
  height: 20px;
}

.logo-text {
  display: flex;
  flex-direction: column;
}

.app-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-h);
  margin: 0;
  letter-spacing: -0.4px;
  line-height: 1.2;
}

.app-subtitle {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 400;
  letter-spacing: 0.3px;
}

.view-nav {
  display: flex;
  gap: 4px;
  background: var(--bg);
  padding: 4px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 14px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 500;
  transition: var(--transition);
  white-space: nowrap;
}

.nav-btn:hover {
  background: var(--accent-bg);
  color: var(--text-h);
}

.nav-btn.active {
  background: var(--bg-elevated);
  color: var(--accent);
  box-shadow: var(--shadow-sm);
}

.nav-icon-svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.search-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-muted);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: var(--transition);
}

.search-trigger:hover {
  border-color: var(--accent-border);
  color: var(--accent);
  background: var(--accent-bg);
}

.search-trigger kbd {
  font-family: var(--mono);
  font-size: 10px;
  padding: 1px 5px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-elevated);
  color: var(--text-muted);
}

.wiki-select {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
  color: var(--text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition);
}

.wiki-select:hover {
  border-color: var(--accent-border);
}

.wiki-select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-bg);
}

.app-main {
  flex: 1;
  overflow: auto;
  background: var(--bg);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
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
  to {
    transform: rotate(360deg);
  }
}
</style>
