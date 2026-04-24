<script setup>
import { api } from '@/api/wiki.js';
import { ChevronDown } from 'lucide-vue-next';

const props = defineProps({
  sectionKey: { type: String, required: true },
  wikiId: { type: String, required: true },
});

const history = ref([]);
const loading = ref(false);
const expanded = ref(null);

watch(
  [() => props.sectionKey, () => props.wikiId],
  async () => {
    if (!props.wikiId) return;
    loading.value = true;
    history.value = [];
    try {
      const data = await api.history(props.sectionKey, props.wikiId, 10);
      history.value = data.history || [];
    } catch {
      history.value = [];
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);

function fmt(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function diffLines(before, after) {
  const bLines = (before || '').split('\n');
  const aLines = (after || '').split('\n');
  const result = [];
  const max = Math.max(bLines.length, aLines.length);
  for (let i = 0; i < max; i++) {
    if (bLines[i] === aLines[i]) result.push({ type: 'same', text: aLines[i] || '' });
    else {
      if (bLines[i] !== undefined) result.push({ type: 'removed', text: bLines[i] });
      if (aLines[i] !== undefined) result.push({ type: 'added', text: aLines[i] });
    }
  }
  return result;
}
</script>

<template>
  <div class="space-y-2">
    <div v-if="loading" class="flex items-center gap-2 py-4 text-muted text-[13px]">
      <div class="w-4 h-4 rounded-full border-2 border-border border-t-accent animate-spin" />
      Loading history…
    </div>
    <div v-else-if="!history.length" class="text-[13px] text-muted italic py-4">
      No history recorded
    </div>
    <div
      v-for="(entry, i) in history"
      :key="i"
      class="rounded-lg border border-border overflow-hidden"
    >
      <button
        class="w-full flex items-center justify-between px-3 py-2.5 bg-surface hover:bg-elevated transition-colors"
        @click="expanded = expanded === i ? null : i"
      >
        <div class="flex items-center gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
          <span class="text-[12px] font-medium text-heading">{{ fmt(entry.changedAt) }}</span>
          <span v-if="entry.changeReason" class="text-[11px] text-muted italic"
            >— {{ entry.changeReason }}</span
          >
        </div>
        <ChevronDown
          class="w-4 h-4 text-muted transition-transform"
          :class="expanded === i ? 'rotate-180' : ''"
        />
      </button>
      <transition name="expand">
        <div v-if="expanded === i" class="border-t border-border">
          <div class="overflow-x-auto max-h-64 text-[12px] font-mono">
            <div
              v-for="(line, j) in diffLines(entry.contentBefore, entry.contentAfter)"
              :key="j"
              :class="[
                'px-4 py-0.5 whitespace-pre',
                line.type === 'added'
                  ? 'bg-success/10 text-success'
                  : line.type === 'removed'
                    ? 'bg-danger/10 text-danger line-through opacity-70'
                    : 'text-text',
              ]"
            >
              {{ line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '
              }}{{ line.text }}
            </div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>
