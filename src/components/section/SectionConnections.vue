<script setup>
import { api } from '@/api/wiki.js';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-vue-next';

const props = defineProps({
  sectionKey: { type: String, required: true },
  wikiId: String,
});
const emit = defineEmits(['navigate']);

const inbound = ref([]);
const outbound = ref([]);
const loading = ref(false);

watch(
  () => props.sectionKey,
  async (key) => {
    if (!key) return;
    loading.value = true;
    inbound.value = [];
    outbound.value = [];
    try {
      const data = await api.connections(key, props.wikiId);
      inbound.value = data.inbound || [];
      outbound.value = data.outbound || [];
    } catch {
      inbound.value = [];
      outbound.value = [];
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="space-y-4">
    <div v-if="loading" class="flex items-center gap-2 py-4 text-muted text-[13px]">
      <div class="w-4 h-4 rounded-full border-2 border-border border-t-accent animate-spin" />
      Loading connections…
    </div>
    <template v-else>
      <!-- Inbound -->
      <div>
        <h4
          class="text-[11px] font-semibold text-heading uppercase tracking-wider mb-2 flex items-center gap-1.5"
        >
          <ArrowDownLeft class="w-3 h-3 text-[#cbd5e1]" />
          Incoming ({{ inbound.length }})
        </h4>
        <div v-if="!inbound.length" class="text-[12px] text-muted italic">None</div>
        <div v-else class="space-y-0.5">
          <button
            v-for="item in inbound"
            :key="item.key"
            class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-accent/10 border border-transparent hover:border-accent/20 transition-all duration-100"
            @click="emit('navigate', item.key)"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-[#cbd5e1] flex-shrink-0" />
            <span class="flex-1 min-w-0">
              <span class="block text-[13px] font-medium text-heading truncate">{{
                item.title
              }}</span>
              <span class="block text-[11px] text-muted">{{ item.parent }}</span>
            </span>
          </button>
        </div>
      </div>

      <!-- Outbound -->
      <div>
        <h4
          class="text-[11px] font-semibold text-heading uppercase tracking-wider mb-2 flex items-center gap-1.5"
        >
          <ArrowUpRight class="w-3 h-3 text-[#fbbf24]" />
          Outgoing ({{ outbound.length }})
        </h4>
        <div v-if="!outbound.length" class="text-[12px] text-muted italic">None</div>
        <div v-else class="space-y-0.5">
          <button
            v-for="item in outbound"
            :key="item.key"
            class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-accent/10 border border-transparent hover:border-accent/20 transition-all duration-100"
            @click="emit('navigate', item.key)"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-[#fbbf24] flex-shrink-0" />
            <span class="flex-1 min-w-0">
              <span class="block text-[13px] font-medium text-heading truncate">{{
                item.title
              }}</span>
              <span class="block text-[11px] text-muted">{{ item.parent }}</span>
            </span>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
