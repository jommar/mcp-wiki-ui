<script setup>
import { api } from '@/api/wiki.js';
import { ArrowRight, ArrowLeft } from 'lucide-vue-next';

const props = defineProps({
  tooltip: { type: Object, required: true },
  wikiId: String,
});

const snippet = ref('');
const loading = ref(false);
let lastKey = null;

watch(() => props.tooltip?.d?.id, async (key) => {
  if (!key || key === lastKey) return;
  lastKey = key;
  snippet.value = '';
  loading.value = true;
  try {
    const data = await api.section(key, props.wikiId, 0, 160);
    snippet.value = (data.content || '').slice(0, 160).trim();
  } catch {
    snippet.value = '';
  } finally {
    loading.value = false;
  }
}, { immediate: true });

const COLOR_OUT = '#fbbf24';
const COLOR_IN = '#cbd5e1';

function pos() {
  const e = props.tooltip.event;
  if (!e) return { left: '0px', top: '0px' };
  return { left: (e.pageX + 16) + 'px', top: (e.pageY - 10) + 'px' };
}
</script>

<template>
  <div
    class="fixed z-[100] max-w-[280px] rounded-xl border border-border p-3 pointer-events-none"
    :style="{ ...pos(), background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)', boxShadow: 'var(--shadow-xl)' }"
  >
    <p class="text-[13px] font-semibold text-heading leading-snug mb-1">{{ tooltip.d.title }}</p>
    <code class="block text-[11px] text-accent font-mono mb-2">{{ tooltip.d.id }}</code>
    <div class="flex gap-2 mb-2">
      <span class="flex items-center gap-1 text-[11px] font-semibold font-mono px-2 py-0.5 rounded-full border"
            :style="{ color: COLOR_OUT, borderColor: COLOR_OUT }">
        <ArrowRight class="w-3 h-3" :stroke-width="2.5" />
        {{ tooltip.outgoing }}
      </span>
      <span class="flex items-center gap-1 text-[11px] font-semibold font-mono px-2 py-0.5 rounded-full border"
            :style="{ color: COLOR_IN, borderColor: COLOR_IN }">
        <ArrowLeft class="w-3 h-3" :stroke-width="2.5" />
        {{ tooltip.incoming }}
      </span>
    </div>
    <div v-if="loading" class="flex items-center gap-2 text-[12px] text-muted">
      <div class="w-3 h-3 rounded-full border border-border border-t-accent animate-spin" />
      Loading…
    </div>
    <p v-else class="text-[12px] text-text leading-snug whitespace-pre-wrap break-words line-clamp-3">
      {{ snippet || 'No preview available' }}
    </p>
  </div>
</template>
