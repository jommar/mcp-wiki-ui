<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { wikiApi } from '../api/wiki.js';

const props = defineProps({ wikiId: String });

const stats = ref(null);
const loading = ref(true);
const sections = ref([]);

const wikiDistribution = ref([]);
const parentDistribution = ref([]);
const contentSizeDistribution = ref([]);

onMounted(async () => {
  await loadData();
});

watch(() => props.wikiId, async () => {
  await loadData();
});

async function loadData() {
  loading.value = true;
  try {
    const [infoData, sectionsData] = await Promise.all([
      wikiApi.getInfo(props.wikiId),
      wikiApi.getSections(props.wikiId, 2000),
    ]);
    stats.value = infoData;
    sections.value = sectionsData.sections || [];

    wikiDistribution.value = infoData.wikis || [];
    computeParentDistribution();
    computeContentSizeDistribution();
  } catch (err) {
    console.error('Failed to load stats:', err);
  } finally {
    loading.value = false;
  }
}

function computeParentDistribution() {
  const parentCounts = {};
  sections.value.forEach(s => {
    const parent = s.parent || 'Root';
    parentCounts[parent] = (parentCounts[parent] || 0) + 1;
  });
  parentDistribution.value = Object.entries(parentCounts)
    .map(([parent, count]) => ({ parent, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

function computeContentSizeDistribution() {
  const buckets = [
    { label: 'Tiny', sub: '<100', min: 0, max: 100, count: 0 },
    { label: 'Small', sub: '100-500', min: 100, max: 500, count: 0 },
    { label: 'Medium', sub: '500-2k', min: 500, max: 2000, count: 0 },
    { label: 'Large', sub: '2k-5k', min: 2000, max: 5000, count: 0 },
    { label: 'XL', sub: '5k-10k', min: 5000, max: 10000, count: 0 },
    { label: 'Huge', sub: '10k+', min: 10000, max: Infinity, count: 0 },
  ];
  sections.value.forEach(s => {
    const len = s.contentLength || 0;
    for (const bucket of buckets) {
      if (len >= bucket.min && len < bucket.max) {
        bucket.count++;
        break;
      }
    }
  });
  contentSizeDistribution.value = buckets;
}

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

const maxParentCount = computed(() => {
  return Math.max(...parentDistribution.value.map(p => p.count), 1);
});

const maxContentBucket = computed(() => {
  return Math.max(...contentSizeDistribution.value.map(b => b.count), 1);
});
</script>

<template>
  <div class="stats-dashboard">
    <div class="stats-header">
      <div class="header-content">
        <h2>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 20V10M12 20V4M6 20v-6"/>
          </svg>
          Wiki Statistics
        </h2>
        <p class="header-desc">Insights and metrics about your knowledge base</p>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="loading-spinner" />
      <span>Loading statistics...</span>
    </div>

    <template v-else>
      <div class="stats-overview">
        <div class="stat-card">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>
            </svg>
          </div>
          <span class="stat-value">{{ sections.length }}</span>
          <span class="stat-label">Total Sections</span>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
            </svg>
          </div>
          <span class="stat-value">{{ wikiDistribution.length }}</span>
          <span class="stat-label">Wiki Instances</span>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <span class="stat-value">{{ parentDistribution.length }}</span>
          <span class="stat-label">Topic Groups</span>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
          </div>
          <span class="stat-value">{{ stats?.uptime ? formatUptime(stats.uptime) : 'N/A' }}</span>
          <span class="stat-label">Server Uptime</span>
        </div>
      </div>

      <div class="stats-charts">
        <div class="chart-card">
          <div class="chart-header">
            <h3>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
              </svg>
              Wiki Distribution
            </h3>
          </div>
          <div class="bar-chart">
            <div
              v-for="wiki in wikiDistribution"
              :key="wiki.wikiId"
              class="bar-row"
            >
              <span class="bar-label">{{ wiki.wikiId }}</span>
              <div class="bar-track">
                <div
                  class="bar-fill"
                  :style="{ width: `${(wiki.sectionCount / Math.max(...wikiDistribution.map(w => w.sectionCount), 1)) * 100}%` }"
                />
              </div>
              <span class="bar-value">{{ wiki.sectionCount }}</span>
            </div>
          </div>
        </div>

        <div class="chart-card">
          <div class="chart-header">
            <h3>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              Top Topic Groups
            </h3>
          </div>
          <div class="bar-chart">
            <div
              v-for="group in parentDistribution"
              :key="group.parent"
              class="bar-row"
            >
              <span class="bar-label">{{ group.parent }}</span>
              <div class="bar-track">
                <div
                  class="bar-fill"
                  :style="{ width: `${(group.count / maxParentCount) * 100}%` }"
                />
              </div>
              <span class="bar-value">{{ group.count }}</span>
            </div>
          </div>
        </div>

        <div class="chart-card">
          <div class="chart-header">
            <h3>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 20V10M12 20V4M6 20v-6"/>
              </svg>
              Content Size Distribution
            </h3>
          </div>
          <div class="histogram">
            <div
              v-for="bucket in contentSizeDistribution"
              :key="bucket.label"
              class="hist-bar-wrapper"
            >
              <span class="hist-count">{{ bucket.count }}</span>
              <div
                class="hist-bar"
                :style="{ height: `${Math.max(12, (bucket.count / maxContentBucket) * 100)}px` }"
                :title="`${bucket.label}: ${bucket.count}`"
              />
              <span class="hist-label">{{ bucket.label }}</span>
              <span class="hist-sub">{{ bucket.sub }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.stats-dashboard {
  padding: 24px;
  height: 100%;
  overflow-y: auto;
}

.stats-header {
  margin-bottom: 24px;
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

.stats-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
  margin-bottom: 24px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 16px;
  background: var(--bg-elevated);
  border-radius: var(--radius-lg);
  text-align: center;
  border: 1px solid var(--border);
  transition: var(--transition);
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.stat-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-bg);
  color: var(--accent);
  border-radius: var(--radius-md);
  margin-bottom: 12px;
}

.stat-value {
  font-size: 28px;
  font-weight: 800;
  color: var(--text-h);
  line-height: 1;
}

.stat-label {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 6px;
  font-weight: 500;
}

.stats-charts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 16px;
}

.chart-card {
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-elevated);
}

.chart-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-h);
  margin: 0 0 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.chart-header h3 svg {
  color: var(--accent);
}

.bar-chart {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.bar-label {
  font-size: 12px;
  color: var(--text-h);
  min-width: 100px;
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}

.bar-track {
  flex: 1;
  height: 22px;
  background: var(--bg);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--gradient-start), var(--gradient-end));
  border-radius: var(--radius-sm);
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.bar-value {
  font-size: 12px;
  color: var(--text-muted);
  min-width: 30px;
  text-align: right;
  font-weight: 600;
  font-family: var(--mono);
}

.histogram {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  height: 180px;
  padding-top: 20px;
  gap: 6px;
}

.hist-bar-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.hist-count {
  font-size: 12px;
  color: var(--text-h);
  font-weight: 700;
  font-family: var(--mono);
}

.hist-bar {
  width: 100%;
  max-width: 50px;
  background: linear-gradient(180deg, var(--gradient-start), var(--gradient-end));
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  min-height: 8px;
  transition: height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.hist-label {
  font-size: 11px;
  color: var(--text-h);
  font-weight: 600;
  text-align: center;
}

.hist-sub {
  font-size: 10px;
  color: var(--text-muted);
  text-align: center;
}
</style>
