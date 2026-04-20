<script setup>
import { ref } from 'vue';
import { wikiApi } from '../api/wiki.js';

const props = defineProps({
  wikiId: String,
  sectionKey: String,
  label: { type: String, default: '' },
  incoming: { type: Boolean, default: false },
  outgoing: { type: Boolean, default: false },
});

const loading = ref(false);
const copied = ref(false);
let copiedTimeout = null;

async function fetchAndCopy() {
  if (!props.sectionKey) return;
  loading.value = true;
  try {
    const data = await wikiApi.getLinksContent(props.sectionKey, props.wikiId, {
      incoming: props.incoming,
      outgoing: props.outgoing,
    });
    const text = data.sections
      .map((s) => {
        // if content starts with # then return content, if not append s.title
        if (s.content.startsWith('#')) {
          return s.content;
        } else {
          return `# ${s.title}\n\n${s.content}`;
        }
      })
      .filter(Boolean)
      .join('\n\n');
    await navigator.clipboard.writeText(text);
    copied.value = true;
    if (copiedTimeout) clearTimeout(copiedTimeout);
    copiedTimeout = setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (err) {
    console.error('Failed to fetch or copy linked content:', err);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <button class="copy-links-btn" :disabled="loading" @click="fetchAndCopy">
    <svg
      v-if="copied"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      class="check-icon"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
    <svg
      v-else-if="!loading"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
    <svg
      v-else
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      class="spin"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
    <span v-if="label">{{ label }}</span>
  </button>
</template>

<style scoped>
.copy-links-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--accent);
  color: var(--bg);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition:
    opacity 0.2s,
    background 0.2s;
}

.copy-links-btn:hover:not(:disabled) {
  opacity: 0.85;
}

.copy-links-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.check-icon {
  animation: pop 0.25s ease-out;
}

@keyframes pop {
  0% {
    transform: scale(0.5);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
