<script setup>
import { computed } from 'vue';
import { usePinnedSections } from '../composables/usePinnedSections.js';

const props = defineProps({
  sectionKey: { type: String, required: true },
  wikiId: { type: String, default: '' },
  title: { type: String, default: '' },
});

const { isPinned, toggle } = usePinnedSections();

const pinned = computed(() => isPinned(props.sectionKey, props.wikiId));

function handleClick() {
  toggle({ key: props.sectionKey, wikiId: props.wikiId, title: props.title });
}
</script>

<template>
  <button
    :class="['pin-btn', { pinned }]"
    :title="pinned ? 'Unpin section' : 'Pin section'"
    @click="handleClick"
  >
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      :fill="pinned ? 'currentColor' : 'none'"
      stroke="currentColor"
      stroke-width="2"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  </button>
</template>

<style scoped>
.pin-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-muted);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition);
  flex-shrink: 0;
}

.pin-btn:hover {
  background: var(--accent-bg);
  color: var(--accent);
  border-color: var(--accent-border);
}

.pin-btn.pinned {
  background: var(--accent-bg);
  color: var(--accent);
  border-color: var(--accent-border);
}
</style>
