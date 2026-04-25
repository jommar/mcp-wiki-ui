<script setup>
import { api } from '@/api/wiki.js';
import { Copy, Check, AlertCircle } from 'lucide-vue-next';

const props = defineProps({
  sectionKey: { type: String, default: '' },
  wikiId: String,
  keys: { type: Array, default: null },
  incoming: { type: Boolean, default: false },
  outgoing: { type: Boolean, default: false },
  label: { type: String, default: '' },
});

const state = ref('idle'); // idle | loading | copied | error

async function copy() {
  if (state.value === 'loading') return;
  state.value = 'loading';
  try {
    let sections = [];
    if (props.keys && props.keys.length > 0) {
      const data = await api.sectionsBatch(props.keys, props.wikiId);
      sections = data.sections || [];
    } else if (props.sectionKey) {
      if (!props.incoming && !props.outgoing) {
        const data = await api.section(props.sectionKey, props.wikiId);
        sections = [data];
      } else {
        const data = await api.linksContent(props.sectionKey, props.wikiId, {
          incoming: props.incoming,
          outgoing: props.outgoing,
        });
        sections = data.sections || [];
      }
    }
    const seen = new Set();
    const text = sections
      .filter((s) => {
        if (!s || seen.has(s.key)) return false;
        seen.add(s.key);
        return true;
      })
      .map((s) => (s.content?.startsWith('#') ? s.content : `## ${s.title}\n\n${s.content}`))
      .join('\n\n---\n\n');
    await navigator.clipboard.writeText(text);
    state.value = 'copied';
    setTimeout(() => {
      state.value = 'idle';
    }, 2000);
  } catch {
    state.value = 'error';
    setTimeout(() => {
      state.value = 'idle';
    }, 2000);
  }
}

const label = () => {
  if (state.value === 'loading') return 'Copying…';
  if (state.value === 'copied') return 'Copied!';
  if (state.value === 'error') return 'Error';
  return (
    props.label ||
    (props.incoming && props.outgoing
      ? 'Copy Links'
      : props.incoming
        ? 'Copy Backlinks'
        : props.outgoing
          ? 'Copy Outlinks'
          : 'Copy')
  );
};

const icon = () => {
  if (state.value === 'copied') return 'check';
  if (state.value === 'error') return 'error';
  return 'copy';
};
</script>

<template>
  <button
    :class="[
      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-medium transition-all duration-150',
      state === 'copied'
        ? 'border-success/40 bg-success/10 text-success'
        : state === 'error'
          ? 'border-danger/40 bg-danger/10 text-danger'
          : 'border-border bg-bg text-muted hover:border-accent/30 hover:text-accent hover:bg-accent/5',
    ]"
    :disabled="state === 'loading'"
    @click="copy"
  >
    <Copy v-if="icon() === 'copy'" class="w-3.5 h-3.5" />
    <Check v-else-if="icon() === 'check'" class="w-3.5 h-3.5" />
    <AlertCircle v-else class="w-3.5 h-3.5" />
    <span v-if="label()">{{ label() }}</span>
  </button>
</template>
