<script setup>
import { ref } from 'vue';
import { ChevronDown, X } from 'lucide-vue-next';

const props = defineProps({
  colors: { type: Object, default: () => ({}) },
  selected: { type: Object, default: () => new Set() },
});
const emit = defineEmits(['toggle', 'clear']);

const collapsed = ref(false);
</script>

<template>
  <div class="absolute bottom-4 left-4 z-20 rounded-xl border border-border overflow-hidden"
       style="background: var(--glass-bg); backdrop-filter: var(--glass-blur); max-width: 220px;">
    <div class="flex items-center justify-between pr-1">
      <button
        class="flex items-center gap-2 w-full px-3 py-2 text-[12px] font-semibold text-heading hover:bg-accent/10 transition-colors"
        @click="collapsed = !collapsed"
      >
        <ChevronDown class="w-3.5 h-3.5 transition-transform duration-200"
             :class="collapsed ? '-rotate-90' : ''" />
        {{ collapsed ? 'Legend' : 'Topic Colors' }}
      </button>
      <button v-if="selected.size > 0"
              class="w-7 h-7 flex items-center justify-center text-danger hover:bg-danger/10 rounded transition-colors flex-shrink-0"
              @click="emit('clear')">
        <X class="w-3.5 h-3.5" />
      </button>
    </div>
    <transition name="expand">
      <div v-show="!collapsed" class="px-2 pb-2 flex flex-col gap-0.5 max-h-[280px] overflow-y-auto">
        <button
          v-for="(color, parent) in colors"
          :key="parent"
          :class="[
            'flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all duration-100',
            selected.size === 0 || selected.has(parent) ? 'opacity-100' : 'opacity-30',
            'hover:bg-accent/10',
          ]"
          @click="emit('toggle', parent)"
        >
          <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="{ background: color }" />
          <span class="text-[11px] font-medium text-text truncate">{{ parent }}</span>
        </button>
      </div>
    </transition>
  </div>
</template>
