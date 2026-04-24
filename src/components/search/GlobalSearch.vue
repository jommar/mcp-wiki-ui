<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { api } from '@/api/wiki.js';
import SearchResultItem from './SearchResultItem.vue';
import { Search } from 'lucide-vue-next';

const props = defineProps({ wikiId: String });
const emit = defineEmits(['navigate']);

const open = ref(false);
const query = ref('');
const results = ref([]);
const loading = ref(false);
const selectedIdx = ref(0);
const inputEl = ref(null);

let debounceTimer = null;

function show() {
  open.value = true;
  query.value = '';
  results.value = [];
  selectedIdx.value = 0;
  nextTick(() => inputEl.value?.focus());
}

function hide() {
  open.value = false;
}

async function search() {
  if (!query.value.trim()) { results.value = []; return; }
  loading.value = true;
  try {
    const data = await api.search(query.value.trim(), props.wikiId || undefined, 20);
    results.value = data.results || [];
    selectedIdx.value = 0;
  } catch {
    results.value = [];
  } finally {
    loading.value = false;
  }
}

function onInput() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(search, 250);
}

function navigate(key) {
  emit('navigate', key);
  hide();
}

function handleKeydown(e) {
  if (e.key === 'Escape') { hide(); return; }
  if (!open.value) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); selectedIdx.value = Math.min(selectedIdx.value + 1, results.value.length - 1); }
  if (e.key === 'ArrowUp') { e.preventDefault(); selectedIdx.value = Math.max(selectedIdx.value - 1, 0); }
  if (e.key === 'Enter' && results.value[selectedIdx.value]) {
    e.preventDefault();
    navigate(results.value[selectedIdx.value].key);
  }
}

function globalKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    open.value ? hide() : show();
  }
}

onMounted(() => document.addEventListener('keydown', globalKeydown));
onUnmounted(() => document.removeEventListener('keydown', globalKeydown));

defineExpose({ open: show });
</script>

<template>
  <teleport to="body">
    <transition name="fade">
      <div v-if="open"
           class="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]"
           style="background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);"
           @click.self="hide">
        <div
          class="w-[580px] max-w-[95vw] max-h-[65vh] flex flex-col rounded-2xl border border-border overflow-hidden"
          style="background: var(--glass-bg); backdrop-filter: var(--glass-blur); box-shadow: var(--shadow-xl);"
          @keydown="handleKeydown"
        >
          <!-- Input -->
          <div class="flex items-center gap-3 px-5 py-4 border-b border-border">
            <Search class="w-5 h-5 text-muted flex-shrink-0" />
            <input
              ref="inputEl"
              v-model="query"
              type="text"
              placeholder="Search sections by title, content, or tag…"
              class="flex-1 bg-transparent text-heading text-[16px] font-medium placeholder:text-muted outline-none"
              @input="onInput"
            />
            <kbd class="px-1.5 py-0.5 rounded text-[10px] border border-border bg-elevated text-muted font-mono flex-shrink-0">ESC</kbd>
          </div>

          <!-- Results -->
          <div class="flex-1 overflow-y-auto p-2">
            <div v-if="loading" class="flex items-center justify-center gap-2 py-8 text-muted text-[13px]">
              <div class="w-4 h-4 rounded-full border-2 border-border border-t-accent animate-spin" />
              Searching…
            </div>
            <div v-else-if="query && !results.length" class="text-center py-8 text-muted text-[13px]">
              No results for "<span class="text-text">{{ query }}</span>"
            </div>
            <div v-else-if="!query" class="text-center py-8 text-muted text-[13px]">
              Start typing to search wiki sections
            </div>
            <SearchResultItem
              v-for="(result, i) in results"
              :key="result.key"
              :result="result"
              :active="i === selectedIdx"
              @click="navigate(result.key)"
              @mouseenter="selectedIdx = i"
            />
          </div>

          <!-- Footer -->
          <div class="flex items-center gap-4 px-5 py-2.5 border-t border-border text-[11px] text-muted">
            <span><kbd class="font-mono border border-border rounded px-1 bg-elevated">↑↓</kbd> navigate</span>
            <span><kbd class="font-mono border border-border rounded px-1 bg-elevated">↵</kbd> open</span>
            <span><kbd class="font-mono border border-border rounded px-1 bg-elevated">ESC</kbd> close</span>
            <span v-if="results.length" class="ml-auto">{{ results.length }} result{{ results.length !== 1 ? 's' : '' }}</span>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>
