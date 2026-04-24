<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/api/wiki.js';
import TagBadge from '@/components/ui/TagBadge.vue';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import EmptyState from '@/components/ui/EmptyState.vue';

const props = defineProps({ wikiId: String });
const router = useRouter();

const groups = ref([]);
const loading = ref(true);
const searchTerm = ref('');
const expandedParents = ref(new Set());
const viewMode = ref('tree'); // tree | flat

async function load() {
  loading.value = true;
  try {
    const data = await api.browse(undefined, props.wikiId || undefined);
    groups.value = data.groups || [];
    expandedParents.value = new Set(groups.value.map((g) => g.parent));
  } catch {
    groups.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(() => props.wikiId, load);

const filtered = computed(() => {
  const term = searchTerm.value.toLowerCase().trim();
  if (!term) return groups.value;
  return groups.value
    .map((g) => ({
      ...g,
      sections: g.sections.filter(
        (s) => s.title.toLowerCase().includes(term) || s.key.toLowerCase().includes(term)
      ),
    }))
    .filter((g) => g.sections.length || g.parent.toLowerCase().includes(term));
});

const totalSections = computed(() => groups.value.reduce((sum, g) => sum + g.sections.length, 0));

function toggle(parent) {
  const s = new Set(expandedParents.value);
  s.has(parent) ? s.delete(parent) : s.add(parent);
  expandedParents.value = s;
}

function expandAll() { expandedParents.value = new Set(groups.value.map((g) => g.parent)); }
function collapseAll() { expandedParents.value = new Set(); }

function navigate(key) {
  router.push({ name: 'section', params: { key }, query: props.wikiId ? { wikiId: props.wikiId } : {} });
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-6 py-8">
    <div class="flex items-start justify-between mb-6 gap-4 flex-wrap">
      <div>
        <h2 class="text-[22px] font-bold text-heading mb-1">Topics</h2>
        <p class="text-[14px] text-muted">{{ groups.length }} topics · {{ totalSections }} sections</p>
      </div>
      <div class="flex items-center gap-2">
        <button class="text-[12px] text-muted hover:text-heading px-2 py-1 rounded hover:bg-elevated transition-colors" @click="expandAll">Expand all</button>
        <span class="text-border">·</span>
        <button class="text-[12px] text-muted hover:text-heading px-2 py-1 rounded hover:bg-elevated transition-colors" @click="collapseAll">Collapse all</button>
      </div>
    </div>

    <!-- Search -->
    <div class="relative mb-6">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none">
        <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        v-model="searchTerm"
        type="text"
        placeholder="Filter topics and sections…"
        class="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-surface text-text text-[14px] placeholder:text-muted focus:outline-none focus:border-accent/50 transition-colors"
      />
    </div>

    <LoadingSpinner v-if="loading" class="mx-auto mt-8" size="lg" />
    <EmptyState v-else-if="!filtered.length" title="No topics found" />

    <div v-else class="space-y-2">
      <div
        v-for="group in filtered"
        :key="group.parent"
        class="rounded-xl border border-border bg-surface overflow-hidden"
      >
        <!-- Parent header -->
        <button
          class="w-full flex items-center justify-between px-4 py-3 hover:bg-elevated transition-colors"
          @click="toggle(group.parent)"
        >
          <div class="flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 class="w-4 h-4 text-muted transition-transform" :class="expandedParents.has(group.parent) ? '' : '-rotate-90'">
              <path d="M6 9l6 6 6-6" />
            </svg>
            <span class="text-[14px] font-semibold text-heading">{{ group.parent }}</span>
          </div>
          <span class="text-[12px] text-muted font-mono bg-elevated px-2 py-0.5 rounded-full border border-border">
            {{ group.sections.length }}
          </span>
        </button>

        <!-- Sections -->
        <transition name="expand">
          <div v-if="expandedParents.has(group.parent)" class="border-t border-border">
            <button
              v-for="section in group.sections"
              :key="section.key"
              class="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-accent/5 border-b border-border/50 last:border-0 transition-colors group"
              @click="navigate(section.key)"
            >
              <div class="flex-1 min-w-0">
                <span class="block text-[13px] font-medium text-heading group-hover:text-accent transition-colors truncate">{{ section.title }}</span>
                <span class="block text-[11px] text-muted font-mono mt-0.5 truncate">{{ section.key }}</span>
              </div>
              <div class="flex items-center gap-2 ml-3 flex-shrink-0">
                <TagBadge v-for="tag in (section.tags || []).slice(0, 2)" :key="tag" :tag="tag" />
                <span v-if="section.contentLength" class="text-[10px] text-muted font-mono">{{ Math.round(section.contentLength / 100) / 10 }}k</span>
              </div>
            </button>
          </div>
        </transition>
      </div>
    </div>
  </div>
</template>
