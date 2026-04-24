<script setup>
import { marked, Renderer } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import MermaidDiagram from './MermaidDiagram.vue';

const props = defineProps({ content: { type: String, default: '' } });

const renderer = new Renderer();
renderer.code = ({ text, lang }) => {
  const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
  const highlighted = hljs.highlight(text, { language }).value;
  return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
};
marked.use({ renderer, breaks: true, gfm: true });

const blocks = ref([]);

watch(() => props.content, parse, { immediate: true });

function parse(raw) {
  if (!raw) {
    blocks.value = [];
    return;
  }
  // Extract mermaid blocks
  const parts = [];
  const re = /```mermaid\n([\s\S]*?)```/g;
  let last = 0,
    m;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) parts.push({ type: 'html', html: marked.parse(raw.slice(last, m.index)) });
    parts.push({ type: 'mermaid', code: m[1].trim() });
    last = m.index + m[0].length;
  }
  if (last < raw.length) parts.push({ type: 'html', html: marked.parse(raw.slice(last)) });
  blocks.value = parts;
}
</script>

<template>
  <div class="prose max-w-none">
    <template v-for="(block, i) in blocks" :key="i">
      <div v-if="block.type === 'html'" v-html="block.html" />
      <MermaidDiagram v-else :code="block.code" />
    </template>
    <div v-if="!blocks.length" class="text-muted text-[13px] italic">No content</div>
  </div>
</template>
