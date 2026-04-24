<script setup>
import { ref } from 'vue';
import { api } from '@/api/wiki.js';

const props = defineProps({
  sectionKey: { type: String, required: true },
  wikiId: String,
  incoming: { type: Boolean, default: true },
  outgoing: { type: Boolean, default: false },
  label: { type: String, default: '' },
});

const state = ref('idle'); // idle | loading | copied | error

async function copy() {
  if (state.value === 'loading') return;
  state.value = 'loading';
  try {
    const data = await api.linksContent(props.sectionKey, props.wikiId, {
      incoming: props.incoming,
      outgoing: props.outgoing,
    });
    const text = (data.sections || [])
      .map((s) => `## ${s.title}\n\n${s.content}`)
      .join('\n\n---\n\n');
    await navigator.clipboard.writeText(text);
    state.value = 'copied';
    setTimeout(() => { state.value = 'idle'; }, 2000);
  } catch {
    state.value = 'error';
    setTimeout(() => { state.value = 'idle'; }, 2000);
  }
}

const label = () => {
  if (state.value === 'loading') return 'Copying…';
  if (state.value === 'copied') return 'Copied!';
  if (state.value === 'error') return 'Error';
  return props.label || (props.incoming && props.outgoing ? 'Copy Links' : props.incoming ? 'Copy Backlinks' : 'Copy Outlinks');
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
      state === 'copied' ? 'border-success/40 bg-success/10 text-success' :
      state === 'error' ? 'border-danger/40 bg-danger/10 text-danger' :
      'border-border bg-bg text-muted hover:border-accent/30 hover:text-accent hover:bg-accent/5',
    ]"
    :disabled="state === 'loading'"
    @click="copy"
  >
    <svg v-if="icon() === 'copy'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
    <svg v-else-if="icon() === 'check'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5">
      <path d="M20 6L9 17l-5-5" />
    </svg>
    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5">
      <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
    </svg>
    <span v-if="label()">{{ label() }}</span>
  </button>
</template>
