<script setup>
import { ref, onMounted, watch, nextTick } from 'vue';
import mermaid from 'mermaid';

const props = defineProps({
  code: String,
  language: String,
});

const container = ref(null);
const loading = ref(true);
const error = ref(null);
const renderId = ref(`mermaid-${Math.random().toString(36).slice(2, 9)}`);

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'Inter, system-ui, sans-serif',
  flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
  sequence: { useMaxWidth: true },
  gantt: { useMaxWidth: true },
});

async function renderDiagram() {
  if (!props.code || !container.value) return;
  loading.value = true;
  error.value = null;

  try {
    const { svg } = await mermaid.render(renderId.value, props.code);
    container.value.innerHTML = svg;
    const svgEl = container.value.querySelector('svg');
    if (svgEl) {
      svgEl.style.maxWidth = '100%';
      svgEl.style.height = 'auto';
    }
  } catch (err) {
    console.warn('Mermaid render failed:', err);
    error.value = err.message || 'Failed to render diagram';
    container.value.innerHTML = `<pre><code class="language-${props.language || 'mermaid'}">${escapeHtml(props.code)}</code></pre>`;
  } finally {
    loading.value = false;
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

onMounted(async () => {
  await nextTick();
  await renderDiagram();
});

watch(() => props.code, async () => {
  renderId.value = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
  await renderDiagram();
});
</script>

<template>
  <div class="mermaid-wrapper">
    <div v-if="loading" class="mermaid-loading">
      <div class="loading-spinner" />
      <span>Rendering diagram...</span>
    </div>
    <div v-else-if="error" class="mermaid-error">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <path d="M12 9v4M12 17h.01"/>
      </svg>
      <span>{{ error }}</span>
    </div>
    <div v-else ref="container" class="mermaid-container" />
  </div>
</template>

<style scoped>
.mermaid-wrapper {
  margin: 16px 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-elevated);
}

.mermaid-container {
  padding: 20px;
  overflow-x: auto;
  display: flex;
  justify-content: center;
}

.mermaid-container :deep(svg) {
  max-width: 100%;
  height: auto;
}

.mermaid-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  color: var(--text-muted);
  font-size: 13px;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.mermaid-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--danger-bg);
  color: var(--danger);
  font-size: 13px;
}
</style>
