<script setup>
import { useGlobalSearch } from '../composables/useGlobalSearch.js';
import { Search } from 'lucide-vue-next';

const props = defineProps({
  wikiId: { type: String, required: true },
});

const emit = defineEmits(['navigate']);

const {
  isOpen,
  query,
  results,
  loading,
  selectedIdx,
  inputRef,
  search,
  handleKeydown,
  close,
  open,
} = useGlobalSearch(
  () => props.wikiId,
  (key) => emit('navigate', key),
);

defineExpose({ open, close });
</script>

<template>
  <teleport to="body">
    <div v-if="isOpen" class="gs-overlay" @click.self="close" @keydown="handleKeydown">
      <div class="gs-modal">
        <div class="gs-input-area">
          <Search :width="20" :height="20" fill="none" stroke="currentColor" :stroke-width="2" />
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            placeholder="Search sections..."
            class="gs-input"
            @input="search"
          />
          <kbd>ESC</kbd>
        </div>
        <div class="gs-results">
          <div v-if="loading" class="gs-loading">
            <div class="gs-spinner" />
            Searching...
          </div>
          <div v-else-if="query && !results.length" class="gs-no-results">
            No results for "{{ query }}"
          </div>
          <div v-else-if="!query" class="gs-hint">Start typing to search</div>
          <template v-else>
            <div
              v-for="(r, i) in results"
              :key="r.key"
              :class="['gs-item', { active: i === selectedIdx }]"
              @click="
                emit('navigate', r.key);
                close();
              "
              @mouseenter="selectedIdx = i"
            >
              <div class="gs-title">{{ r.title }}</div>
              <div class="gs-meta">
                <span class="gs-key">{{ r.key }}</span
                ><span>{{ r.parent }}</span>
              </div>
            </div>
          </template>
        </div>
        <div class="gs-footer">
          <span><kbd>↑↓</kbd>navigate</span><span><kbd>↵</kbd>open</span
          ><span><kbd>ESC</kbd>close</span>
        </div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.gs-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
}
.gs-modal {
  width: 100%;
  max-width: 560px;
  background: var(--bg-elevated, #fff);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
}
.gs-input-area {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}
.gs-input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 15px;
  outline: none;
}
.gs-input::placeholder {
  color: var(--text-muted);
}
.gs-input-area kbd {
  font-family: var(--mono);
  font-size: 10px;
  padding: 2px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  color: var(--text-muted);
}
.gs-results {
  max-height: 360px;
  overflow-y: auto;
}
.gs-loading,
.gs-no-results,
.gs-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 32px;
  color: var(--text-muted);
}
.gs-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.gs-item {
  padding: 10px 16px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-light);
}
.gs-item:last-child {
  border-bottom: none;
}
.gs-item:hover,
.gs-item.active {
  background: var(--accent-bg);
}
.gs-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-h);
  margin-bottom: 2px;
}
.gs-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
}
.gs-key {
  color: var(--accent);
  font-family: var(--mono);
}
.gs-meta span:last-child {
  color: var(--text-muted);
}
.gs-footer {
  display: flex;
  gap: 16px;
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  background: var(--bg);
  font-size: 11px;
  color: var(--text-muted);
}
.gs-footer kbd {
  font-family: var(--mono);
  font-size: 10px;
  padding: 1px 4px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg-elevated, #f5f5f5);
  margin-right: 4px;
}
</style>
