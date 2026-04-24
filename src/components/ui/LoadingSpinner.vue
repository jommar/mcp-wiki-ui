<script setup>
defineProps({ size: { type: String, default: 'md' } });
const sizes = { sm: 'w-4 h-4 border-2', md: 'w-8 h-8 border-2', lg: 'w-12 h-12 border-3' };
</script>
<template>
  <div
    :class="[sizes[size] || sizes.md, 'rounded-full border-border border-t-accent animate-spin']"
  />
</template>
