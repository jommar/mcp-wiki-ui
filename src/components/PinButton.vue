<script setup>
import { usePinnedSections } from '../composables/usePinnedSections.js';
import { Star } from 'lucide-vue-next';

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
    <Star :width="16" :height="16" :fill="pinned ? 'currentColor' : 'none'" stroke="currentColor" :stroke-width="2" />
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
