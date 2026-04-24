<script setup>
defineProps({ tag: { type: String, required: true } });
</script>
<template>
  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-elevated border border-border text-muted">
    {{ tag }}
  </span>
</template>
