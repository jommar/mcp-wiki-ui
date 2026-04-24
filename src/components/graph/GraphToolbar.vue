<script setup>
import { Search, Sun, Network, GitBranch, Plus, Minus, RotateCcw, X } from 'lucide-vue-next';

defineProps({
  filter: String,
  layoutMode: String,
  focusMode: Boolean,
  zoomLevel: Number,
  nodeCount: Number,
  edgeCount: Number,
  selectedParentCount: Number,
});
const emit = defineEmits([
  'update:filter',
  'toggle-layout',
  'toggle-focus',
  'zoom-in',
  'zoom-out',
  'reset-zoom',
  'clear-filter',
]);
</script>

<template>
  <div class="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-surface flex-wrap">
    <!-- Search filter -->
    <div class="relative flex items-center flex-1 min-w-[160px] max-w-xs">
      <Search class="absolute left-3 w-4 h-4 text-muted pointer-events-none" />
      <input
        :value="filter"
        type="text"
        placeholder="Filter nodes…"
        class="w-full pl-9 pr-3 py-1.5 rounded-lg border border-border bg-bg text-text text-[13px] placeholder:text-muted focus:outline-none focus:border-accent/50 transition-colors"
        @input="emit('update:filter', $event.target.value)"
      />
    </div>

    <!-- Tools -->
    <div class="flex items-center gap-1">
      <button
        :class="[
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-medium transition-all duration-150',
          focusMode
            ? 'border-accent/40 bg-accent/10 text-accent'
            : 'border-border bg-bg text-muted hover:text-heading hover:bg-accent/5',
        ]"
        title="Focus mode: dim unrelated nodes on hover"
        @click="emit('toggle-focus')"
      >
        <Sun class="w-4 h-4" />
        <span class="hidden sm:inline">Focus</span>
      </button>

      <button
        :class="[
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-medium transition-all duration-150',
          layoutMode === 'tree'
            ? 'border-accent/40 bg-accent/10 text-accent'
            : 'border-border bg-bg text-muted hover:text-heading hover:bg-accent/5',
        ]"
        :title="layoutMode === 'force' ? 'Switch to Tree layout' : 'Switch to Force layout'"
        @click="emit('toggle-layout')"
      >
        <component :is="layoutMode === 'force' ? Network : GitBranch" class="w-4 h-4" />
        <span class="hidden sm:inline">{{ layoutMode === 'force' ? 'Force' : 'Tree' }}</span>
      </button>
    </div>

    <!-- Zoom -->
    <div class="flex items-center gap-1 px-1 py-1 rounded-lg border border-border bg-bg">
      <button
        class="w-7 h-7 flex items-center justify-center rounded text-text hover:bg-accent/10 hover:text-accent transition-colors"
        @click="emit('zoom-in')"
      >
        <Plus class="w-4 h-4" />
      </button>
      <span class="text-[12px] text-muted font-mono w-11 text-center select-none"
        >{{ Math.round(zoomLevel * 100) }}%</span
      >
      <button
        class="w-7 h-7 flex items-center justify-center rounded text-text hover:bg-accent/10 hover:text-accent transition-colors"
        @click="emit('zoom-out')"
      >
        <Minus class="w-4 h-4" />
      </button>
      <button
        class="px-2 h-7 flex items-center rounded text-[11px] text-muted hover:bg-accent/10 hover:text-accent transition-colors"
        @click="emit('reset-zoom')"
      >
        <RotateCcw class="w-4 h-4" />
      </button>
    </div>

    <!-- Stats -->
    <div class="flex items-center gap-2 ml-auto">
      <span
        class="text-[12px] text-muted bg-bg border border-border px-2.5 py-1 rounded-full font-mono"
        >{{ nodeCount }} nodes</span
      >
      <span
        class="text-[12px] text-muted bg-bg border border-border px-2.5 py-1 rounded-full font-mono"
        >{{ edgeCount }} links</span
      >
      <button
        v-if="selectedParentCount > 0"
        class="flex items-center gap-1.5 text-[12px] font-semibold text-danger bg-danger/10 border border-danger/30 px-3 py-1 rounded-full hover:bg-danger hover:text-white hover:border-danger transition-all duration-150"
        @click="emit('clear-filter')"
      >
        <X class="w-3.5 h-3.5" />
        {{ selectedParentCount }} filtered
      </button>
    </div>
  </div>
</template>
