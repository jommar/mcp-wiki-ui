<script setup>
defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  sub: { type: String, default: '' },
  accent: { type: Boolean, default: false },
  icon: { type: Object, default: null },
});
</script>

<template>
  <div :class="['p-4 rounded-xl border transition-colors', accent ? 'border-accent/30 bg-accent/5' : 'border-border bg-surface']">
    <div class="flex items-center justify-between mb-1">
      <p class="text-[12px] text-muted uppercase tracking-wider font-medium">{{ label }}</p>
      <component v-if="icon" :is="icon" class="w-4 h-4 text-muted" />
    </div>
    <p :class="['text-[28px] font-bold leading-none', accent ? 'text-accent' : 'text-heading']">{{ value }}</p>
    <p v-if="sub" class="text-[12px] text-muted mt-1">{{ sub }}</p>
  </div>
</template>
