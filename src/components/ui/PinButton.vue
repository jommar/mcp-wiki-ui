<script setup>
import { computed } from 'vue';
import { usePinnedSections } from '@/composables/usePinnedSections.js';

const props = defineProps({
  sectionKey: { type: String, required: true },
  wikiId: String,
  title: String,
});

const { isPinned, toggle } = usePinnedSections();
const pinned = computed(() => isPinned(props.sectionKey, props.wikiId));

function handleClick() {
  toggle({ key: props.sectionKey, wikiId: props.wikiId, title: props.title });
}
</script>

<template>
  <button
    :title="pinned ? 'Unpin section' : 'Pin section'"
    :class="[
      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-medium transition-all duration-150',
      pinned
        ? 'border-warning/40 bg-warning/10 text-warning hover:bg-warning/20'
        : 'border-border bg-bg text-muted hover:border-warning/30 hover:text-warning hover:bg-warning/5',
    ]"
    @click="handleClick"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"
         :class="pinned ? 'fill-warning stroke-warning' : ''">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
    {{ pinned ? 'Pinned' : 'Pin' }}
  </button>
</template>
