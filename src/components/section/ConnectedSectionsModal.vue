<script setup>
import { api } from '@/api/wiki.js';
import SectionContent from './SectionContent.vue';
import { Check, Copy, X, Frown, ChevronRight } from 'lucide-vue-next';

const props = defineProps({
  sectionKey: { type: String, required: true },
  wikiId: String,
  relatedKeys: { type: Array, default: null },
});

const router = useRouter();

const visible = ref(false);
const loading = ref(false);
const sections = ref([]);
const copiedKey = ref(null);
let copyTimer = null;

function open() {
  visible.value = true;
  if (sections.value.length) return; // already loaded
  load();
}

async function load() {
  loading.value = true;
  sections.value = [];
  try {
    if (props.relatedKeys && props.relatedKeys.length > 0) {
      const keys = [...new Set([props.sectionKey, ...props.relatedKeys])];
      const data = await api.sectionsBatch(keys, props.wikiId);
      const all = data.sections || [];
      // Sort: current section first
      all.sort((a, b) => {
        if (a.key === props.sectionKey) return -1;
        if (b.key === props.sectionKey) return 1;
        return 0;
      });
      sections.value = all;
    } else {
      const [inData, outData] = await Promise.all([
        api.linksContent(props.sectionKey, props.wikiId, { incoming: true, outgoing: false }),
        api.linksContent(props.sectionKey, props.wikiId, { incoming: false, outgoing: true }),
      ]);
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
    }
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
  copyTimer = setTimeout(() => {
    copiedKey.value = null;
  }, 2000);
}

async function copyAll() {
  const text = sections.value.map((s) => `# ${s.title}\n\n${s.content}`).join('\n\n---\n\n');
  await navigator.clipboard.writeText(text).catch(() => {});
  copiedKey.value = '__all__';
  clearTimeout(copyTimer);
  copyTimer = setTimeout(() => {
    copiedKey.value = null;
  }, 2000);
}

function navigate(key) {
  close();
  router.push({
    name: 'section',
    params: { key },
    query: props.wikiId ? { wikiId: props.wikiId } : {},
  });
}

function onKey(e) {
  if (e.key === 'Escape' && visible.value) close();
}

onMounted(() => document.addEventListener('keydown', onKey));
onUnmounted(() => {
  document.removeEventListener('keydown', onKey);
  clearTimeout(copyTimer);
});

defineExpose({ open });
</script>

<template>
  <teleport to="body">
    <transition name="fade">
      <div
        v-if="visible"
        class="fixed inset-0 z-[300] flex items-center justify-center p-6"
        style="background: rgba(0, 0, 0, 0.65); backdrop-filter: blur(4px)"
        @click.self="close"
      >
        <div
          class="flex flex-col w-full max-w-3xl rounded-2xl border border-border overflow-hidden"
          style="
            background: var(--glass-bg);
            backdrop-filter: var(--glass-blur);
            box-shadow: var(--shadow-xl);
            max-height: 86vh;
          "
        >
          <!-- Header -->
          <div
            class="flex items-center justify-between px-5 py-3.5 border-b border-border flex-shrink-0"
          >
            <div class="flex items-center gap-3">
              <h3 class="text-[15px] font-bold text-heading">Related Sections</h3>
              <span
                v-if="!loading"
                class="text-[12px] text-muted font-mono bg-elevated border border-border px-2 py-0.5 rounded-full"
              >
                {{ sections.length }}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="sections.length"
                :class="[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-all duration-150',
                  copiedKey === '__all__'
                    ? 'border-success/40 bg-success/10 text-success'
                    : 'border-border bg-elevated text-muted hover:border-accent/30 hover:text-accent hover:bg-accent/5',
                ]"
                @click="copyAll"
              >
                <Check v-if="copiedKey === '__all__'" class="w-3.5 h-3.5" />
                <Copy v-else class="w-3.5 h-3.5" />
                {{ copiedKey === '__all__' ? 'Copied!' : 'Copy All' }}
              </button>
              <button
                class="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                @click="close"
              >
                <X class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            <!-- Loading -->
            <div
              v-if="loading"
              class="flex flex-col items-center justify-center gap-3 py-16 text-muted"
            >
              <div
                class="w-8 h-8 rounded-full border-2 border-border border-t-accent animate-spin"
              />
              <span class="text-[13px]">Loading related sections…</span>
            </div>

            <!-- Empty -->
            <div
              v-else-if="!sections.length"
              class="flex flex-col items-center justify-center gap-3 py-16 text-muted"
            >
              <Frown class="w-10 h-10 opacity-30" />
              <p class="text-[14px]">No related sections</p>
            </div>

            <!-- Section cards -->
            <div
              v-for="s in sections"
              :key="s.key"
              :class="[
                'rounded-xl border overflow-hidden transition-colors',
                s.key === props.sectionKey
                  ? 'border-accent/30 bg-accent/5'
                  : 'border-border',
              ]"
            >
              <!-- Card header -->
              <div
                class="flex items-center justify-between gap-3 px-4 py-2.5 bg-surface border-b border-border"
              >
                <div class="flex-1 min-w-0">
                  <span class="block text-[13px] font-semibold text-heading truncate">{{
                    s.title
                  }}</span>
                  <code class="text-[11px] text-accent font-mono">{{ s.key }}</code>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <!-- Copy section -->
                  <button
                    :class="[
                      'w-7 h-7 flex items-center justify-center rounded-lg border transition-all duration-150',
                      copiedKey === s.key
                        ? 'border-success/40 bg-success/10 text-success'
                        : 'border-border bg-bg text-muted hover:border-accent/30 hover:text-accent hover:bg-accent/5',
                    ]"
                    :title="copiedKey === s.key ? 'Copied!' : 'Copy section'"
                    @click="copySection(s)"
                  >
                    <Check v-if="copiedKey === s.key" class="w-3.5 h-3.5" :stroke-width="2.5" />
                    <Copy v-else class="w-3.5 h-3.5" />
                  </button>
                  <!-- Navigate -->
                  <button
                    class="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-bg text-[12px] text-muted hover:border-accent/30 hover:text-accent hover:bg-accent/5 transition-all duration-150"
                    @click="navigate(s.key)"
                  >
                    Open
                    <ChevronRight class="w-3 h-3" />
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
