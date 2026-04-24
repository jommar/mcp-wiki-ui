<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { api } from '@/api/wiki.js';
import SectionContent from './SectionContent.vue';

const props = defineProps({
  sectionKey: { type: String, required: true },
  wikiId: String,
});

const router = useRouter();
const route = useRoute();

const visible = ref(false);
const loading = ref(false);
const sections = ref([]);
const copiedKey = ref(null);
let copyTimer = null;

async function open() {
  visible.value = true;
  if (sections.value.length) return; // already loaded
  load();
}

async function load() {
  loading.value = true;
  sections.value = [];
  try {
    const [inData, outData] = await Promise.all([
      api.linksContent(props.sectionKey, props.wikiId, { incoming: true, outgoing: false }),
      api.linksContent(props.sectionKey, props.wikiId, { incoming: false, outgoing: true }),
    ]);
    // Build direction map, exclude the current section (it appears in both results as the anchor)
    const map = new Map();
    for (const s of inData.sections || []) {
      if (s.key === props.sectionKey) continue;
      map.set(s.key, { ...s, direction: 'incoming' });
    }
    for (const s of outData.sections || []) {
      if (s.key === props.sectionKey) continue;
      if (map.has(s.key)) map.get(s.key).direction = 'both';
      else map.set(s.key, { ...s, direction: 'outgoing' });
    }
    sections.value = [...map.values()];
  } finally {
    loading.value = false;
  }
}

function close() {
  visible.value = false;
}

async function copySection(s) {
  const text = `# ${s.title}\n\n${s.content}`;
  await navigator.clipboard.writeText(text).catch(() => {});
  copiedKey.value = s.key;
  clearTimeout(copyTimer);
  copyTimer = setTimeout(() => { copiedKey.value = null; }, 2000);
}

async function copyAll() {
  const text = sections.value
    .map((s) => `# ${s.title}\n\n${s.content}`)
    .join('\n\n---\n\n');
  await navigator.clipboard.writeText(text).catch(() => {});
  copiedKey.value = '__all__';
  clearTimeout(copyTimer);
  copyTimer = setTimeout(() => { copiedKey.value = null; }, 2000);
}

function navigate(key) {
  close();
  router.push({ name: 'section', params: { key }, query: props.wikiId ? { wikiId: props.wikiId } : {} });
}

function onKey(e) {
  if (e.key === 'Escape' && visible.value) close();
}

onMounted(() => document.addEventListener('keydown', onKey));
onUnmounted(() => { document.removeEventListener('keydown', onKey); clearTimeout(copyTimer); });

defineExpose({ open });
</script>

<template>
  <teleport to="body">
    <transition name="fade">
      <div
        v-if="visible"
        class="fixed inset-0 z-[300] flex items-center justify-center p-6"
        style="background: rgba(0,0,0,0.65); backdrop-filter: blur(4px);"
        @click.self="close"
      >
        <div
          class="flex flex-col w-full max-w-3xl rounded-2xl border border-border overflow-hidden"
          style="background: var(--glass-bg); backdrop-filter: var(--glass-blur); box-shadow: var(--shadow-xl); max-height: 86vh;"
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-5 py-3.5 border-b border-border flex-shrink-0">
            <div class="flex items-center gap-3">
              <h3 class="text-[15px] font-bold text-heading">Connected Sections</h3>
              <span v-if="!loading" class="text-[12px] text-muted font-mono bg-elevated border border-border px-2 py-0.5 rounded-full">
                {{ sections.length }}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="sections.length"
                :class="['flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-all duration-150',
                  copiedKey === '__all__'
                    ? 'border-success/40 bg-success/10 text-success'
                    : 'border-border bg-elevated text-muted hover:border-accent/30 hover:text-accent hover:bg-accent/5']"
                @click="copyAll"
              >
                <svg v-if="copiedKey === '__all__'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                {{ copiedKey === '__all__' ? 'Copied!' : 'Copy All' }}
              </button>
              <button
                class="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                @click="close"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            <!-- Loading -->
            <div v-if="loading" class="flex flex-col items-center justify-center gap-3 py-16 text-muted">
              <div class="w-8 h-8 rounded-full border-2 border-border border-t-accent animate-spin" />
              <span class="text-[13px]">Loading connected sections…</span>
            </div>

            <!-- Empty -->
            <div v-else-if="!sections.length" class="flex flex-col items-center justify-center gap-3 py-16 text-muted">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-10 h-10 opacity-30">
                <circle cx="12" cy="12" r="10" /><path d="M8 15s1.5 2 4 2 4-2 4-2" /><path d="M9 9h.01M15 9h.01" />
              </svg>
              <p class="text-[14px]">No connected sections</p>
            </div>

            <!-- Section cards -->
            <div
              v-for="s in sections"
              :key="s.key"
              class="rounded-xl border border-border overflow-hidden"
            >
              <!-- Card header -->
              <div class="flex items-center justify-between gap-3 px-4 py-2.5 bg-surface border-b border-border">
                <div class="flex-1 min-w-0">
                  <span class="block text-[13px] font-semibold text-heading truncate">{{ s.title }}</span>
                  <code class="text-[11px] text-accent font-mono">{{ s.key }}</code>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <!-- Direction badge -->
                  <span
                    v-if="s.direction !== 'both'"
                    :class="['flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border',
                      s.direction === 'incoming'
                        ? 'text-[#94a3b8] border-[#cbd5e1]/30 bg-[#cbd5e1]/10'
                        : 'text-[#d97706] border-[#fbbf24]/30 bg-[#fbbf24]/10']"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-2.5 h-2.5">
                      <path v-if="s.direction === 'incoming'" d="M19 12H5M11 6l-6 6 6 6" />
                      <path v-else d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                    {{ s.direction }}
                  </span>
                  <span v-else class="flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border border-border text-muted bg-elevated">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-2.5 h-2.5"><path d="M7 16V4m0 0L3 8m4-4l4 4" /></svg>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-2.5 h-2.5"><path d="M17 8v12m0 0l4-4m-4 4l-4-4" /></svg>
                    both
                  </span>
                  <!-- Copy section -->
                  <button
                    :class="['w-7 h-7 flex items-center justify-center rounded-lg border transition-all duration-150',
                      copiedKey === s.key
                        ? 'border-success/40 bg-success/10 text-success'
                        : 'border-border bg-bg text-muted hover:border-accent/30 hover:text-accent hover:bg-accent/5']"
                    :title="copiedKey === s.key ? 'Copied!' : 'Copy section'"
                    @click="copySection(s)"
                  >
                    <svg v-if="copiedKey === s.key" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-3.5 h-3.5">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                  <!-- Navigate -->
                  <button
                    class="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-bg text-[12px] text-muted hover:border-accent/30 hover:text-accent hover:bg-accent/5 transition-all duration-150"
                    @click="navigate(s.key)"
                  >
                    Open
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3 h-3"><path d="M9 18l6-6-6-6" /></svg>
                  </button>
                </div>
              </div>
              <!-- Card content -->
              <div class="px-4 py-3 bg-bg/50 text-[13px]">
                <SectionContent :content="s.content" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>
