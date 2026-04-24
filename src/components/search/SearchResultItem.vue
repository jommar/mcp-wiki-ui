<script setup>
defineProps({
  result: { type: Object, required: true },
  active: { type: Boolean, default: false },
});
</script>

<template>
  <div
    :class="[
      'px-4 py-3 rounded-lg cursor-pointer transition-all duration-100 border',
      active ? 'bg-accent/10 border-accent/30' : 'border-transparent hover:bg-accent/5 hover:border-accent/20',
    ]"
  >
    <div class="flex items-start justify-between gap-2">
      <span class="text-[14px] font-semibold text-heading leading-snug">{{ result.title }}</span>
      <span v-if="result.accessCount" class="flex-shrink-0 text-[10px] text-muted font-mono bg-elevated px-1.5 py-0.5 rounded">
        {{ result.accessCount }}×
      </span>
    </div>
    <div class="flex items-center gap-2 mt-0.5">
      <code class="text-[11px] text-accent font-mono bg-accent/10 px-1.5 py-0.5 rounded">{{ result.key }}</code>
      <span class="text-[11px] text-muted">{{ result.parent }}</span>
      <span v-for="tag in (result.tags || []).slice(0, 3)" :key="tag"
            class="text-[10px] text-muted bg-elevated px-1.5 py-0.5 rounded-full border border-border">
        {{ tag }}
      </span>
    </div>
    <p v-if="result.snippet" class="mt-1.5 text-[12px] text-text leading-snug line-clamp-2">
      {{ result.snippet }}
    </p>
  </div>
</template>
