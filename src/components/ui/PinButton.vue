<script setup>
import { usePinnedSections } from '@/composables/usePinnedSections.js';
import { Star } from 'lucide-vue-next';

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
    <Star class="w-3.5 h-3.5" :class="pinned ? 'text-warning' : ''" :fill="pinned ? 'currentColor' : 'none'" />
    {{ pinned ? 'Pinned' : 'Pin' }}
  </button>
</template>
