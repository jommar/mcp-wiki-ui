<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/api/wiki.js';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import EmptyState from '@/components/ui/EmptyState.vue';

const props = defineProps({ wikiId: String });
const router = useRouter();

const report = ref(null);
const loading = ref(true);
const activeTab = ref('empty');

async function load() {
  loading.value = true;
  try {
    report.value = await api.validate(props.wikiId || undefined);
  } catch {
    report.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(() => props.wikiId, load);

const tabs = computed(() => [
  { id: 'empty', label: 'Empty', count: report.value?.emptySections?.length || 0, color: 'text-danger' },
  { id: 'orphaned', label: 'Orphaned', count: report.value?.orphanedSections?.length || 0, color: 'text-warning' },
]);

const activeList = computed(() => {
  if (!report.value) return [];
  return activeTab.value === 'empty' ? report.value.emptySections : report.value.orphanedSections;
});

function navigate(key) {
  router.push({ name: 'section', params: { key }, query: props.wikiId ? { wikiId: props.wikiId } : {} });
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-6 py-8">
    <div class="mb-6">
      <h2 class="text-[22px] font-bold text-heading mb-1">Health Report</h2>
      <p class="text-[14px] text-muted">Identify sections that need attention</p>
    </div>

    <LoadingSpinner v-if="loading" class="mx-auto mt-12" size="lg" />

    <template v-else-if="report">
      <!-- Summary cards -->
      <div class="grid grid-cols-2 gap-4 mb-8">
        <div class="p-4 rounded-xl border border-danger/30 bg-danger/5">
          <p class="text-[12px] text-muted uppercase tracking-wider mb-1">Empty Sections</p>
          <p class="text-[32px] font-bold text-danger leading-none">{{ report.emptySections?.length || 0 }}</p>
          <p class="text-[12px] text-muted mt-1">sections with no content</p>
        </div>
        <div class="p-4 rounded-xl border border-warning/30 bg-warning/5">
          <p class="text-[12px] text-muted uppercase tracking-wider mb-1">Orphaned</p>
          <p class="text-[32px] font-bold text-warning leading-none">{{ report.orphanedSections?.length || 0 }}</p>
          <p class="text-[12px] text-muted mt-1">sections with no links</p>
        </div>
      </div>

      <!-- Overall health -->
      <div v-if="!report.emptySections?.length && !report.orphanedSections?.length" class="text-center py-10">
        <div class="text-success text-[48px] mb-3">✓</div>
        <p class="text-[18px] font-semibold text-heading">Wiki looks healthy!</p>
        <p class="text-[14px] text-muted mt-1">No empty or orphaned sections found</p>
      </div>

      <template v-else>
        <!-- Tabs -->
        <div class="flex gap-1 p-1 bg-surface rounded-xl border border-border mb-4 w-fit">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            :class="['px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 flex items-center gap-2',
              activeTab === tab.id ? 'bg-elevated shadow-sm text-heading' : 'text-muted hover:text-heading hover:bg-accent/5']"
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
            <span :class="['text-[11px] font-mono px-1.5 py-0.5 rounded-full', activeTab === tab.id ? tab.color + ' bg-current/10' : 'bg-elevated text-muted']">
              {{ tab.count }}
            </span>
          </button>
        </div>

        <!-- List -->
        <div v-if="!activeList.length">
          <EmptyState title="All clear" :message="`No ${activeTab} sections found`" />
        </div>
        <div v-else class="space-y-1">
          <button
            v-for="s in activeList"
            :key="s.key"
            class="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-surface hover:border-accent/30 hover:bg-accent/5 transition-all duration-100 text-left"
            @click="navigate(s.key)"
          >
            <div class="flex items-center gap-3">
              <span :class="['w-2 h-2 rounded-full flex-shrink-0', activeTab === 'empty' ? 'bg-danger' : 'bg-warning']" />
              <div>
                <span class="block text-[13px] font-medium text-heading">{{ s.title }}</span>
                <code class="text-[11px] text-muted font-mono">{{ s.key }}</code>
              </div>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4 text-muted">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </template>
    </template>
  </div>
</template>
