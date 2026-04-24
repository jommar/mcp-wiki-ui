<script setup>
import { api } from '@/api/wiki.js';
import CopyLinksButton from '@/components/ui/CopyLinksButton.vue';
import { X, CircleDot, Eye, Link, Frown } from 'lucide-vue-next';

const props = defineProps({
  node: { type: Object, required: true },
  wikiId: String,
  parentColors: { type: Object, default: () => ({}) },
});
const emit = defineEmits(['close', 'navigate']);

const backlinks = ref([]);
const loading = ref(false);

watch(
  () => props.node?.id,
  async (key) => {
    if (!key) return;
    loading.value = true;
    backlinks.value = [];
    try {
      const data = await api.backlinks(key, props.wikiId);
      backlinks.value = data.backlinks || [];
    } catch {
      backlinks.value = [];
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);

const color = () => props.parentColors[props.node?.parent || 'Root'] || '#818cf8';
</script>

<template>
  <div
    class="absolute right-0 top-0 bottom-0 w-[320px] flex flex-col border-l border-border z-10 overflow-hidden"
    style="background: var(--glass-bg); backdrop-filter: var(--glass-blur)"
  >
    <!-- Header -->
    <div class="flex items-start justify-between p-4 border-b border-border flex-shrink-0">
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="{ background: color() }" />
        <h3 class="text-[14px] font-semibold text-heading leading-snug">{{ node.title }}</h3>
      </div>
      <button
        class="w-7 h-7 flex items-center justify-center text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors flex-shrink-0 ml-2"
        @click="emit('close')"
      >
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- Meta -->
    <div class="px-4 py-3 border-b border-border flex-shrink-0 space-y-1">
      <code class="block text-[12px] text-accent font-mono">{{ node.id }}</code>
      <p class="text-[12px] text-muted">{{ node.parent || 'Root' }}</p>
      <p v-if="node.centrality" class="flex items-center gap-1 text-[12px] text-muted">
        <CircleDot class="w-3.5 h-3.5" />
        {{ node.centrality }} connections
      </p>
    </div>

    <!-- Actions -->
    <div class="px-4 py-3 border-b border-border flex gap-2 flex-shrink-0">
      <button
        class="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-accent/30 bg-accent/10 text-accent text-[13px] font-semibold hover:bg-accent hover:text-white hover:border-accent transition-all duration-150"
        @click="emit('navigate', node.id)"
      >
        <Eye class="w-4 h-4" />
        View Content
      </button>
      <CopyLinksButton :section-key="node.id" :wiki-id="wikiId" :incoming="true" :outgoing="true" />
    </div>

    <!-- Backlinks -->
    <div class="flex-1 overflow-y-auto">
      <div
        class="flex items-center justify-between px-4 py-2.5 border-b border-border sticky top-0 bg-surface/80 backdrop-blur"
      >
        <h4
          class="text-[11px] font-semibold text-heading uppercase tracking-wider flex items-center gap-1.5"
        >
          <Link class="w-3.5 h-3.5" />
          Incoming Links ({{ backlinks.length }})
        </h4>
        <CopyLinksButton :section-key="node.id" :wiki-id="wikiId" :incoming="true" label="Copy" />
      </div>

      <div
        v-if="loading"
        class="flex items-center justify-center gap-2 py-6 text-muted text-[13px]"
      >
        <div class="w-4 h-4 rounded-full border-2 border-border border-t-accent animate-spin" />
      </div>
      <div v-else-if="!backlinks.length" class="flex flex-col items-center gap-2 py-8 text-muted">
        <Frown class="w-8 h-8 opacity-40" />
        <p class="text-[13px]">No incoming links</p>
      </div>
      <div v-else class="px-2 py-1">
        <button
          v-for="bl in backlinks"
          :key="bl.key"
          class="w-full flex flex-col px-3 py-2.5 rounded-lg text-left hover:bg-accent/10 border border-transparent hover:border-accent/20 transition-all duration-100 mb-0.5"
          @click="emit('navigate', bl.key)"
        >
          <span class="text-[13px] font-medium text-heading leading-snug">{{ bl.title }}</span>
          <span class="text-[11px] text-muted mt-0.5">{{ bl.parent }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
