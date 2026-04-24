<script setup>
import { api } from '@/api/wiki.js';
import SearchResultItem from '@/components/search/SearchResultItem.vue';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import { Search } from 'lucide-vue-next';

const props = defineProps({ wikiId: String });
const router = useRouter();

const query = ref('');
const results = ref([]);
const loading = ref(false);
const searched = ref(false);

let debounce = null;

watch(query, () => {
  clearTimeout(debounce);
  if (!query.value.trim()) { results.value = []; searched.value = false; return; }
  debounce = setTimeout(search, 300);
});

async function search() {
  loading.value = true;
  searched.value = true;
  try {
    const data = await api.search(query.value.trim(), props.wikiId || undefined, 30);
    results.value = data.results || [];
  } catch {
    results.value = [];
  } finally {
    loading.value = false;
  }
}

function navigate(key) {
  router.push({ name: 'section', params: { key }, query: props.wikiId ? { wikiId: props.wikiId } : {} });
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-6 py-8">
    <div class="mb-8">
      <h2 class="text-[22px] font-bold text-heading mb-1">Search</h2>
      <p class="text-[14px] text-muted">Full-text search across all wiki sections</p>
    </div>

    <!-- Search input -->
    <div class="relative mb-6">
      <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted pointer-events-none" />
      <input
        v-model="query"
        type="text"
        placeholder="Search sections by title, content, or tags…"
        class="w-full pl-12 pr-4 py-3 rounded-xl border border-border bg-surface text-heading text-[15px] placeholder:text-muted focus:outline-none focus:border-accent/50 transition-colors"
        autofocus
      />
    </div>

    <!-- Results -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <LoadingSpinner size="lg" />
    </div>
    <div v-else-if="searched && !results.length">
      <EmptyState title="No results found" :message="`No sections matched &quot;${query}&quot;`" />
    </div>
    <div v-else-if="results.length">
      <p class="text-[12px] text-muted mb-3">{{ results.length }} result{{ results.length !== 1 ? 's' : '' }} for "{{ query }}"</p>
      <div class="space-y-1">
        <SearchResultItem
          v-for="result in results"
          :key="result.key"
          :result="result"
          @click="navigate(result.key)"
        />
      </div>
    </div>
    <div v-else class="text-center py-16 text-muted">
      <Search class="w-12 h-12 mx-auto mb-3 opacity-30" :stroke-width="1.5" />
      <p class="text-[14px]">Type to search wiki sections</p>
    </div>
  </div>
</template>
