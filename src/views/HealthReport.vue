<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { wikiApi } from '../api/wiki.js';

const props = defineProps({ wikiId: String });
const router = useRouter();

const validation = ref(null);
const loading = ref(true);

const totalIssues = computed(() => {
  if (!validation.value) return 0;
  return (validation.value.emptySections?.length || 0) +
    (validation.value.orphanedSections?.length || 0) +
    (validation.value.unlinkedSections?.length || 0);
});

const healthScore = computed(() => {
  if (!validation.value) return 100;
  const total = (validation.value.emptySections?.length || 0) +
    (validation.value.orphanedSections?.length || 0) +
    (validation.value.unlinkedSections?.length || 0);
  if (total === 0) return 100;
  return Math.max(0, Math.round(100 - (total * 2)));
});

const healthColor = computed(() => {
  if (healthScore.value >= 80) return 'var(--success)';
  if (healthScore.value >= 50) return 'var(--warning)';
  return 'var(--danger)';
});

const healthBg = computed(() => {
  if (healthScore.value >= 80) return 'var(--success-bg)';
  if (healthScore.value >= 50) return 'var(--warning-bg)';
  return 'var(--danger-bg)';
});

const healthLabel = computed(() => {
  if (healthScore.value >= 90) return 'Excellent';
  if (healthScore.value >= 80) return 'Good';
  if (healthScore.value >= 50) return 'Warning';
  return 'Critical';
});

onMounted(async () => {
  await loadValidation();
});

watch(() => props.wikiId, async () => {
  await loadValidation();
});

async function loadValidation() {
  loading.value = true;
  try {
    validation.value = await wikiApi.validate(props.wikiId);
  } catch (err) {
    console.error('Validation failed:', err);
  } finally {
    loading.value = false;
  }
}

function navigateTo(key) {
  router.push({ name: 'section', params: { sectionKey: key }, query: props.wikiId ? { wikiId: props.wikiId } : {} });
}
</script>

<template>
  <div class="health-report">
    <div class="report-header">
      <div class="header-content">
        <h2>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="M9 12l2 2 4-4"/>
          </svg>
          Health & Integrity Report
        </h2>
        <p class="header-desc">Monitor wiki quality and detect issues</p>
      </div>
      <button class="refresh-btn" @click="loadValidation" :disabled="loading">
        <svg v-if="loading" class="btn-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 2v4h-4M3 22v-4h4"/>
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 12a9 9 0 0 1-15 6.7L3 16"/>
        </svg>
        {{ loading ? 'Checking...' : 'Refresh' }}
      </button>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="loading-spinner" />
      <span>Running validation checks...</span>
    </div>

    <template v-else>
      <div class="health-score-card">
        <div class="score-circle" :style="{ borderColor: healthColor, background: healthBg }">
          <span class="score-value" :style="{ color: healthColor }">{{ healthScore }}</span>
          <span class="score-label">Health Score</span>
        </div>
        <div class="score-details">
          <span class="score-status" :style="{ color: healthColor }">{{ healthLabel }}</span>
          <span class="total-issues">{{ totalIssues }} issue{{ totalIssues !== 1 ? 's' : '' }} found</span>
        </div>
      </div>

      <div class="issue-cards">
        <div class="issue-card empty">
          <div class="issue-header">
            <div class="issue-icon warning">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <path d="M12 9v4M12 17h.01"/>
              </svg>
            </div>
            <h3>Empty Sections</h3>
            <span class="issue-count">{{ validation?.emptySections?.length || 0 }}</span>
          </div>
          <p class="issue-desc">Sections with no content — placeholders or drafts</p>
          <ul v-if="validation?.emptySections?.length" class="issue-list">
            <li v-for="item in validation.emptySections" :key="item.key">
              <a href="#" @click.prevent="navigateTo(item.key)">{{ item.title }}</a>
              <span class="item-key">{{ item.key }}</span>
            </li>
          </ul>
          <div v-else class="no-issues">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <path d="M22 4L12 14.01l-3-3"/>
            </svg>
            <span>All sections have content</span>
          </div>
        </div>

        <div class="issue-card orphaned">
          <div class="issue-header">
            <div class="issue-icon danger">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/>
              </svg>
            </div>
            <h3>Orphaned Sections</h3>
            <span class="issue-count">{{ validation?.orphanedSections?.length || 0 }}</span>
          </div>
          <p class="issue-desc">No parent, children, or backlinks — completely isolated</p>
          <ul v-if="validation?.orphanedSections?.length" class="issue-list">
            <li v-for="item in validation.orphanedSections" :key="item.key">
              <a href="#" @click.prevent="navigateTo(item.key)">{{ item.title }}</a>
              <span class="item-key">{{ item.key }}</span>
            </li>
          </ul>
          <div v-else class="no-issues">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <path d="M22 4L12 14.01l-3-3"/>
            </svg>
            <span>No orphaned sections</span>
          </div>
        </div>

        <div class="issue-card unlinked">
          <div class="issue-header">
            <div class="issue-icon info">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
            </div>
            <h3>Unlinked Sections</h3>
            <span class="issue-count">{{ validation?.unlinkedSections?.length || 0 }}</span>
          </div>
          <p class="issue-desc">Has parent but never referenced in any other section</p>
          <ul v-if="validation?.unlinkedSections?.length" class="issue-list">
            <li v-for="item in validation.unlinkedSections" :key="item.key">
              <a href="#" @click.prevent="navigateTo(item.key)">{{ item.title }}</a>
              <span class="item-key">{{ item.key }}</span>
            </li>
          </ul>
          <div v-else class="no-issues">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <path d="M22 4L12 14.01l-3-3"/>
            </svg>
            <span>All sections are linked</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.health-report {
  padding: 24px;
  height: 100%;
  overflow-y: auto;
}

.report-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
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

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: var(--transition);
  box-shadow: var(--shadow-sm);
  white-space: nowrap;
}

.refresh-btn:hover {
  border-color: var(--accent-border);
  color: var(--accent);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-spinner {
  width: 16px;
  height: 16px;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
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

.health-score-card {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 24px;
  background: var(--bg-elevated);
  border-radius: var(--radius-lg);
  margin-bottom: 24px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
}

.score-circle {
  width: 110px;
  height: 110px;
  border-radius: 50%;
  border: 5px solid;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.score-value {
  font-size: 36px;
  font-weight: 800;
  line-height: 1;
}

.score-label {
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
  margin-top: 4px;
}

.score-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.score-status {
  font-size: 20px;
  font-weight: 700;
}

.total-issues {
  font-size: 14px;
  color: var(--text-muted);
}

.issue-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}

.issue-card {
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-elevated);
  transition: var(--transition);
}

.issue-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.issue-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.issue-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  flex-shrink: 0;
}

.issue-icon.warning {
  background: var(--warning-bg);
  color: var(--warning);
}

.issue-icon.danger {
  background: var(--danger-bg);
  color: var(--danger);
}

.issue-icon.info {
  background: var(--accent-bg);
  color: var(--accent);
}

.issue-header h3 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-h);
  margin: 0;
  flex: 1;
}

.issue-count {
  font-size: 14px;
  font-weight: 700;
  color: var(--accent);
  background: var(--accent-bg);
  padding: 4px 12px;
  border-radius: 20px;
  font-family: var(--mono);
}

.issue-desc {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0 0 14px;
}

.issue-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 280px;
  overflow-y: auto;
}

.issue-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  transition: var(--transition);
}

.issue-list li:hover {
  background: var(--accent-bg);
}

.issue-list a {
  color: var(--text-h);
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
}

.issue-list a:hover {
  color: var(--accent);
}

.item-key {
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--mono);
  opacity: 0.6;
}

.no-issues {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  color: var(--success);
  font-size: 13px;
  font-weight: 500;
}

.no-issues svg {
  opacity: 0.8;
}
</style>
