<script setup>
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePinnedSections } from '@/composables/usePinnedSections.js';
import { Sun, Network, Search, LayoutGrid, ShieldCheck, BarChart3, Star } from 'lucide-vue-next';

const props = defineProps({
  wikis: { type: Array, default: () => [] },
  selectedWiki: { type: String, default: '' },
});
const emit = defineEmits(['open-search', 'change-wiki']);

const route = useRoute();
const router = useRouter();
const { pinned } = usePinnedSections();

const pinnedOpen = ref(false);

const nav = [
  { id: 'graph', label: 'Graph', path: '/graph', icon: 'graph' },
  { id: 'search', label: 'Search', path: '/search', icon: 'search' },
  { id: 'topics', label: 'Topics', path: '/topics', icon: 'topics' },
  { id: 'health', label: 'Health', path: '/health', icon: 'health' },
  { id: 'stats', label: 'Stats', path: '/stats', icon: 'stats' },
];

const activeView = computed(() => {
  const seg = route.path.split('/')[1];
  return seg || 'graph';
});

function go(item) {
  router.push({ path: item.path, query: props.selectedWiki ? { wikiId: props.selectedWiki } : {} });
}

function navigatePinned(item) {
  pinnedOpen.value = false;
  router.push({ name: 'section', params: { key: item.key }, query: item.wikiId ? { wikiId: item.wikiId } : {} });
}

</script>

<template>
  <header class="flex-shrink-0 relative z-40" style="background: var(--glass-bg); backdrop-filter: var(--glass-blur); border-bottom: 1px solid var(--glass-border);">
    <div class="flex items-center h-[60px] px-5 gap-5">
      <!-- Logo -->
      <div class="flex items-center gap-3 flex-shrink-0">
        <div class="w-9 h-9 flex items-center justify-center rounded-[8px] text-white"
             style="background: linear-gradient(135deg, #818cf8, #a78bfa);">
          <Sun class="w-5 h-5" />
        </div>
        <div>
          <h1 class="text-[15px] font-bold text-heading leading-tight tracking-tight">Wiki Explorer</h1>
          <p class="text-[11px] text-muted leading-none mt-0.5">Knowledge Visualization</p>
        </div>
      </div>

      <!-- Nav -->
      <nav class="flex gap-1 p-1 rounded-xl border border-border bg-bg">
        <button
          v-for="item in nav"
          :key="item.id"
          :class="[
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150',
            activeView === item.id
              ? 'bg-elevated text-accent shadow-sm'
              : 'text-muted hover:text-heading hover:bg-accent/10'
          ]"
          @click="go(item)"
        >
          <component
            :is="{ graph: Network, search: Search, topics: LayoutGrid, health: ShieldCheck, stats: BarChart3 }[item.icon]"
            class="w-4 h-4 flex-shrink-0"
            :stroke-width="1.8"
          />
          <span class="hidden sm:inline">{{ item.label }}</span>
        </button>
      </nav>

      <!-- Right actions -->
      <div class="flex items-center gap-2 ml-auto flex-shrink-0">
        <!-- Pinned -->
        <div class="relative">
          <button
            :class="['relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-medium transition-all duration-150',
              pinnedOpen ? 'border-accent/40 bg-accent/10 text-accent' : 'border-border bg-bg text-muted hover:border-accent/30 hover:text-heading']"
            @click="pinnedOpen = !pinnedOpen"
          >
            <Star class="w-4 h-4" />
            <span class="hidden sm:inline">Pinned</span>
            <span v-if="pinned.length"
                  class="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-accent text-white text-[9px] font-bold flex items-center justify-center">
              {{ pinned.length }}
            </span>
          </button>

          <transition name="slide-up">
            <div v-if="pinnedOpen"
                 class="absolute right-0 top-full mt-1.5 w-72 rounded-xl border border-border overflow-hidden z-50"
                 style="background: var(--glass-bg); backdrop-filter: var(--glass-blur); box-shadow: var(--shadow-xl);">
              <div class="flex items-center justify-between px-3 py-2 border-b border-border">
                <span class="text-[12px] font-semibold text-heading">Pinned Sections</span>
                <span class="text-[11px] text-muted">{{ pinned.length }} item{{ pinned.length !== 1 ? 's' : '' }}</span>
              </div>
              <div v-if="!pinned.length" class="px-3 py-4 text-center text-[12px] text-muted">
                No pinned sections yet
              </div>
              <div v-else class="max-h-64 overflow-y-auto">
                <button
                  v-for="item in pinned"
                  :key="`${item.wikiId}:${item.key}`"
                  class="w-full flex flex-col px-3 py-2 text-left hover:bg-accent/10 transition-colors duration-100"
                  @click="navigatePinned(item)"
                >
                  <span class="text-[13px] font-medium text-heading truncate">{{ item.title || item.key }}</span>
                  <span class="text-[11px] text-muted font-mono truncate">{{ item.key }}</span>
                </button>
              </div>
            </div>
          </transition>
        </div>

        <!-- Search -->
        <button
          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-bg text-muted text-[12px] font-medium hover:border-accent/30 hover:text-heading hover:bg-accent/5 transition-all duration-150"
          @click="emit('open-search')"
        >
          <Search class="w-4 h-4" />
          <span class="hidden sm:inline">Search</span>
          <kbd class="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-border bg-elevated text-muted font-mono">⌘K</kbd>
        </button>

        <!-- Wiki select -->
        <select
          v-if="wikis.length > 1"
          :value="selectedWiki"
          class="px-2.5 py-1.5 rounded-lg border border-border bg-elevated text-text text-[13px] font-medium cursor-pointer hover:border-accent/30 focus:outline-none focus:border-accent/50 transition-colors duration-150"
          @change="emit('change-wiki', $event.target.value)"
        >
          <option value="">All Wikis</option>
          <option v-for="w in wikis" :key="w.wikiId" :value="w.wikiId">{{ w.wikiId }}</option>
        </select>
      </div>
    </div>

    <!-- Accent line -->
    <div class="absolute bottom-0 left-0 right-0 h-px opacity-30"
         style="background: linear-gradient(90deg, transparent, #818cf8, transparent);" />

    <!-- Close pinned panel on outside click -->
    <div v-if="pinnedOpen" class="fixed inset-0 z-40" @click="pinnedOpen = false" />
  </header>
</template>
