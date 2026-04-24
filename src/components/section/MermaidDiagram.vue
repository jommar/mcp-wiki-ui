<script setup>
import { ref, watch, onMounted } from 'vue';
import mermaid from 'mermaid';

mermaid.initialize({ startOnLoad: false, theme: 'dark', darkMode: true, securityLevel: 'loose' });

const props = defineProps({ code: { type: String, required: true } });
const containerEl = ref(null);
const error = ref(null);
let renderCount = 0;

async function render() {
  if (!containerEl.value || !props.code) return;
  error.value = null;
  const id = `mermaid-${++renderCount}`;
  try {
    const { svg } = await mermaid.render(id, props.code);
    containerEl.value.innerHTML = svg;
  } catch (e) {
    error.value = e.message;
  }
}

onMounted(render);
watch(() => props.code, render);
</script>

<template>
  <div class="my-4">
    <div v-if="error" class="px-3 py-2 rounded-lg bg-danger/10 border border-danger/30 text-danger text-[12px] font-mono">
      Mermaid error: {{ error }}
    </div>
    <div v-else ref="containerEl" class="flex justify-center overflow-x-auto" />
  </div>
</template>
