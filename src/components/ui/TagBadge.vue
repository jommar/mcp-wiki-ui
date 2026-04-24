<script setup>
import { Tag } from 'lucide-vue-next';

defineProps({ tag: { type: String, required: true } });
</script>
<template>
  <span
    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-elevated border border-border text-muted"
  >
    <Tag class="w-2.5 h-2.5" />
    {{ tag }}
  </span>
</template>
