<script setup>
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
  'update:filter', 'toggle-layout', 'toggle-focus',
  'zoom-in', 'zoom-out', 'reset-zoom', 'clear-filter',
]);
</script>

<template>
  <div class="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-surface flex-wrap">
    <!-- Search filter -->
    <div class="relative flex items-center flex-1 min-w-[160px] max-w-xs">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           class="absolute left-3 w-4 h-4 text-muted pointer-events-none">
        <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
      </svg>
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
        :class="['flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-medium transition-all duration-150',
          focusMode ? 'border-accent/40 bg-accent/10 text-accent' : 'border-border bg-bg text-muted hover:text-heading hover:bg-accent/5']"
        title="Focus mode: dim unrelated nodes on hover"
        @click="emit('toggle-focus')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
        </svg>
        <span class="hidden sm:inline">Focus</span>
      </button>

      <button
        :class="['flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-medium transition-all duration-150',
          layoutMode === 'tree' ? 'border-accent/40 bg-accent/10 text-accent' : 'border-border bg-bg text-muted hover:text-heading hover:bg-accent/5']"
        :title="layoutMode === 'force' ? 'Switch to Tree layout' : 'Switch to Force layout'"
        @click="emit('toggle-layout')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4">
          <template v-if="layoutMode === 'force'">
            <circle cx="5" cy="6" r="2" /><circle cx="19" cy="6" r="2" /><circle cx="12" cy="18" r="2" />
            <path d="M7 7l4 9M17 7l-4 9M7 6h10" />
          </template>
          <template v-else>
            <path d="M12 2v8M8 10l4-8 4 8M6 18h12M12 10v8" />
          </template>
        </svg>
        <span class="hidden sm:inline">{{ layoutMode === 'force' ? 'Force' : 'Tree' }}</span>
      </button>
    </div>

    <!-- Zoom -->
    <div class="flex items-center gap-1 px-1 py-1 rounded-lg border border-border bg-bg">
      <button class="w-7 h-7 flex items-center justify-center rounded text-text hover:bg-accent/10 hover:text-accent transition-colors" @click="emit('zoom-in')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path d="M12 5v14M5 12h14" /></svg>
      </button>
      <span class="text-[12px] text-muted font-mono w-11 text-center select-none">{{ Math.round(zoomLevel * 100) }}%</span>
      <button class="w-7 h-7 flex items-center justify-center rounded text-text hover:bg-accent/10 hover:text-accent transition-colors" @click="emit('zoom-out')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path d="M5 12h14" /></svg>
      </button>
      <button class="px-2 h-7 flex items-center rounded text-[11px] text-muted hover:bg-accent/10 hover:text-accent transition-colors" @click="emit('reset-zoom')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path d="M3 12a9 9 0 1 1 3 6.75"/><path d="M3 21v-6h6"/></svg>
      </button>
    </div>

    <!-- Stats -->
    <div class="flex items-center gap-2 ml-auto">
      <span class="text-[12px] text-muted bg-bg border border-border px-2.5 py-1 rounded-full font-mono">{{ nodeCount }} nodes</span>
      <span class="text-[12px] text-muted bg-bg border border-border px-2.5 py-1 rounded-full font-mono">{{ edgeCount }} links</span>
      <button
        v-if="selectedParentCount > 0"
        class="flex items-center gap-1.5 text-[12px] font-semibold text-danger bg-danger/10 border border-danger/30 px-3 py-1 rounded-full hover:bg-danger hover:text-white hover:border-danger transition-all duration-150"
        @click="emit('clear-filter')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
        {{ selectedParentCount }} filtered
      </button>
    </div>
  </div>
</template>
