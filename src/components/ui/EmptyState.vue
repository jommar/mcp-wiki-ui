<script setup>
defineProps({
  icon: { type: String, default: 'empty' },
  title: { type: String, default: 'Nothing here yet' },
  message: { type: String, default: '' },
});
</script>

<template>
  <div class="flex flex-col items-center gap-3 py-12 text-muted">
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      class="w-10 h-10 opacity-40"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 15s1.5 2 4 2 4-2 4-2" />
      <path d="M9 9h.01M15 9h.01" />
    </svg>
    <p class="text-[14px] font-medium text-heading">{{ title }}</p>
    <p v-if="message" class="text-[13px] text-center max-w-xs">{{ message }}</p>
    <slot />
  </div>
</template>
