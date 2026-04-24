<script setup>
import { ref, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/api/wiki.js';
import StatCard from '@/components/ui/StatCard.vue';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import { Layers, FileText, Link, BarChart3, Eye, TrendingUp, Clock } from 'lucide-vue-next';

const props = defineProps({ wikiId: String });
const router = useRouter();

const stats = ref(null);
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    stats.value = await api.stats(props.wikiId || undefined);
  } catch {
    stats.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(() => props.wikiId, load);

function navigate(key) {
  router.push({ name: 'section', params: { key }, query: props.wikiId ? { wikiId: props.wikiId } : {} });
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-6 py-8">
    <div class="mb-8">
      <h2 class="text-[22px] font-bold text-heading mb-1">Statistics</h2>
      <p class="text-[14px] text-muted">Wiki usage and structure metrics</p>
    </div>

    <LoadingSpinner v-if="loading" class="mx-auto mt-12" size="lg" />

    <template v-else-if="stats">
      <!-- Summary cards -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <StatCard label="Total Sections" :value="stats.totalSections" accent :icon="Layers" />
        <StatCard label="With Content" :value="stats.sectionsWithContent"
          :sub="`${Math.round(stats.sectionsWithContent / stats.totalSections * 100)}% coverage`" :icon="FileText" />
        <StatCard label="Total Links" :value="stats.totalLinks" :icon="Link" />
        <StatCard label="Avg Links/Section"
          :value="(stats.totalLinks / (stats.totalSections || 1)).toFixed(1)" :icon="BarChart3" />
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <!-- Most accessed -->
        <div>
          <h3 class="flex items-center gap-1.5 text-[13px] font-semibold text-heading uppercase tracking-wider mb-3"><Eye class="w-3.5 h-3.5" /> Most Accessed</h3>
          <div class="space-y-0.5">
            <button
              v-for="(s, i) in (stats.topAccessed || [])"
              :key="s.key"
              class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/5 border border-transparent hover:border-accent/20 transition-all duration-100 text-left"
              @click="navigate(s.key)"
            >
              <span class="w-6 h-6 rounded-full bg-elevated border border-border text-[11px] text-muted font-mono flex items-center justify-center flex-shrink-0">
                {{ i + 1 }}
              </span>
              <div class="flex-1 min-w-0">
                <span class="block text-[13px] font-medium text-heading truncate">{{ s.title }}</span>
                <span class="text-[11px] text-muted">Last: {{ fmtDate(s.lastAccessed) }}</span>
              </div>
              <span class="text-[12px] text-accent font-mono font-semibold flex-shrink-0">{{ s.accessCount }}×</span>
            </button>
            <p v-if="!stats.topAccessed?.length" class="text-[13px] text-muted italic py-3 px-3">No access data yet</p>
          </div>
        </div>

        <!-- Most linked -->
        <div>
          <h3 class="flex items-center gap-1.5 text-[13px] font-semibold text-heading uppercase tracking-wider mb-3"><TrendingUp class="w-3.5 h-3.5" /> Most Linked</h3>
          <div class="space-y-0.5">
            <button
              v-for="(s, i) in (stats.topLinked || [])"
              :key="s.key"
              class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/5 border border-transparent hover:border-accent/20 transition-all duration-100 text-left"
              @click="navigate(s.key)"
            >
              <span class="w-6 h-6 rounded-full bg-elevated border border-border text-[11px] text-muted font-mono flex items-center justify-center flex-shrink-0">
                {{ i + 1 }}
              </span>
              <div class="flex-1 min-w-0">
                <span class="block text-[13px] font-medium text-heading truncate">{{ s.title }}</span>
              </div>
              <span class="text-[12px] text-accent font-mono font-semibold flex-shrink-0">{{ s.linkCount }} links</span>
            </button>
            <p v-if="!stats.topLinked?.length" class="text-[13px] text-muted italic py-3 px-3">No link data yet</p>
          </div>
        </div>
      </div>

      <!-- Recently edited -->
      <div v-if="stats.recentlyEdited?.length" class="mt-8">
        <h3 class="flex items-center gap-1.5 text-[13px] font-semibold text-heading uppercase tracking-wider mb-3"><Clock class="w-3.5 h-3.5" /> Recently Edited</h3>
        <div class="space-y-0.5">
          <button
            v-for="s in stats.recentlyEdited"
            :key="s.key"
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/5 border border-transparent hover:border-accent/20 transition-all duration-100 text-left"
            @click="navigate(s.key)"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
            <code class="text-[12px] text-accent font-mono">{{ s.key }}</code>
            <span v-if="s.changeReason" class="text-[12px] text-muted italic truncate flex-1">{{ s.changeReason }}</span>
            <span class="text-[11px] text-muted flex-shrink-0 ml-auto">{{ fmtDate(s.changedAt) }}</span>
          </button>
        </div>
      </div>
    </template>

    <div v-else class="text-center py-16 text-muted">Failed to load statistics</div>
  </div>
</template>
