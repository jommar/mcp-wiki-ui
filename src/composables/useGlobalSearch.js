import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { wikiApi } from '../api/wiki.js';

/**
 * Composable for global search (Cmd+K palette)
 * @param {string|function} wikiId - Wiki ID to search in
 * @param {function} onNavigate - Callback when a result is selected
 */
export function useGlobalSearch(wikiId, onNavigate) {
  const inputRef = ref(null);

  const isOpen = ref(false);
  const query = ref('');
  const results = ref([]);
  const loading = ref(false);
  const selectedIdx = ref(0);

  function open() {
    isOpen.value = true;
    query.value = '';
    results.value = [];
    selectedIdx.value = 0;
    nextTick(() => inputRef.value?.focus());
  }

  function close() {
    isOpen.value = false;
  }

  function toggle() {
    if (isOpen.value) close();
    else open();
  }

  async function search() {
    if (!query.value.trim()) {
      results.value = [];
      return;
    }
    loading.value = true;
    try {
      const id = typeof wikiId.value === 'function' ? wikiId.value() : wikiId.value;
      const data = await wikiApi.search(query.value, id, true, 15);
      results.value = data.results || [];
      selectedIdx.value = 0;
    } catch {
      results.value = [];
    } finally {
      loading.value = false;
    }
  }

  function navigateToResult(result) {
    onNavigate?.(result.key);
    close();
  }

  function handleKeydown(e) {
    if (!isOpen.value) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIdx.value = Math.min(selectedIdx.value + 1, results.value.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIdx.value = Math.max(selectedIdx.value - 1, 0);
    } else if (e.key === 'Enter' && results.value[selectedIdx.value]) {
      e.preventDefault();
      navigateToResult(results.value[selectedIdx.value]);
    }
  }

  function handleGlobalKeydown(e) {
    if (e.key === 'Escape' && isOpen.value) {
      e.preventDefault();
      close();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      toggle();
    }
  }

  onMounted(() => document.addEventListener('keydown', handleGlobalKeydown));
  onUnmounted(() => document.removeEventListener('keydown', handleGlobalKeydown));

  return {
    isOpen,
    query,
    results,
    loading,
    selectedIdx,
    inputRef,
    open,
    close,
    toggle,
    search,
    navigateToResult,
    handleKeydown,
  };
}
