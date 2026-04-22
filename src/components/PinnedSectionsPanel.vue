<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { usePinnedSections } from '../composables/usePinnedSections.js';

const props = defineProps({
  wikiId: { type: String, default: '' },
});

const emit = defineEmits(['navigate']);

const { pinned, unpin } = usePinnedSections();

const open = ref(false);
const panelRef = ref(null);

function toggle(e) {
  e.stopPropagation();
  open.value = !open.value;
}

function navigate(item) {
  emit('navigate', { key: item.key, wikiId: item.wikiId });
  open.value = false;
}

function remove(item, e) {
  e.stopPropagation();
  unpin(item.key, item.wikiId);
}

function onDocClick(e) {
  if (panelRef.value && !panelRef.value.contains(e.target)) {
    open.value = false;
  }
}

function onKeydown(e) {
  if (e.key === 'Escape') open.value = false;
}

onMounted(() => {
  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick);
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div ref="panelRef" class="pinned-panel">
    <button
      :class="['pinned-trigger', { active: open, 'has-pins': pinned.length > 0 }]"
      :title="`Pinned sections (${pinned.length})`"
      @click="toggle"
    >
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        :fill="pinned.length > 0 ? 'currentColor' : 'none'"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
      <span>Pins</span>
      <span v-if="pinned.length > 0" class="pin-count">{{ pinned.length }}</span>
    </button>

    <Teleport to="body">
      <div v-if="open" class="pinned-dropdown" :style="dropdownStyle">
        <div class="dropdown-header">
          <span>Pinned Sections</span>
        </div>
        <div v-if="!pinned.length" class="dropdown-empty">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <p>No pinned sections yet</p>
          <span>Pin a section using the star button in the section viewer</span>
        </div>
        <ul v-else class="dropdown-list">
          <li
            v-for="item in pinned"
            :key="item.key + item.wikiId"
            class="dropdown-item"
            @click="navigate(item)"
          >
            <div class="item-info">
              <span class="item-title">{{ item.title || item.key }}</span>
              <span class="item-meta">
                <span class="item-key">{{ item.key }}</span>
                <span v-if="item.wikiId" class="item-wiki">{{ item.wikiId }}</span>
              </span>
            </div>
            <button class="item-remove" title="Unpin" @click="remove(item, $event)">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </li>
        </ul>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.pinned-panel {
  position: relative;
}

.pinned-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-muted);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: var(--transition);
  white-space: nowrap;
}

.pinned-trigger:hover,
.pinned-trigger.active {
  border-color: var(--accent-border);
  color: var(--accent);
  background: var(--accent-bg);
}

.pinned-trigger.has-pins {
  color: var(--accent);
}

.pin-count {
  font-size: 11px;
  background: var(--accent);
  color: white;
  border-radius: 10px;
  padding: 1px 6px;
  font-weight: 600;
  line-height: 1.4;
}

.pinned-dropdown {
  position: fixed;
  top: 64px;
  right: 20px;
  width: 320px;
  max-height: 480px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg, 0 12px 40px rgba(0, 0, 0, 0.2));
  z-index: 500;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dropdown-header {
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-h);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.dropdown-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 20px;
  color: var(--text-muted);
  text-align: center;
}

.dropdown-empty svg {
  opacity: 0.25;
}

.dropdown-empty p {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
}

.dropdown-empty span {
  font-size: 12px;
}

.dropdown-list {
  list-style: none;
  padding: 6px;
  margin: 0;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 10px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition);
}

.dropdown-item:hover {
  background: var(--accent-bg);
}

.item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-h);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-meta {
  display: flex;
  gap: 6px;
  align-items: center;
}

.item-key {
  font-size: 11px;
  color: var(--accent);
  font-family: var(--mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}

.item-wiki {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 1px 5px;
  flex-shrink: 0;
}

.item-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition);
  flex-shrink: 0;
  opacity: 0;
}

.dropdown-item:hover .item-remove {
  opacity: 1;
}

.item-remove:hover {
  background: var(--bg);
  color: var(--danger, #ef4444);
}
</style>
