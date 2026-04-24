<script setup>
import { ref, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from './api/wiki.js';
import AppHeader from './components/layout/AppHeader.vue';
import GlobalSearch from './components/search/GlobalSearch.vue';

const route = useRoute();
const router = useRouter();

const wikis = ref([]);
const selectedWiki = ref('');
const globalSearch = ref(null);

onMounted(async () => {
  try {
    const data = await api.info();
    wikis.value = data.wikis || [];
  } catch {}
});

watch(
  () => route.query.wikiId,
  (id) => { selectedWiki.value = id || ''; },
  { immediate: true },
);

function navigate(key) {
  router.push({ name: 'section', params: { key }, query: selectedWiki.value ? { wikiId: selectedWiki.value } : {} });
}

function changeWiki(id) {
  selectedWiki.value = id;
  router.push({ ...route, query: id ? { wikiId: id } : {} });
}
</script>

<template>
  <div class="flex flex-col h-full bg-bg text-text">
    <AppHeader
      :wikis="wikis"
      :selected-wiki="selectedWiki"
      @open-search="globalSearch?.open()"
      @change-wiki="changeWiki"
    />
    <main class="flex-1 overflow-auto bg-bg">
      <router-view :wiki-id="selectedWiki" />
    </main>
    <GlobalSearch
      ref="globalSearch"
      :wiki-id="selectedWiki"
      @navigate="navigate"
    />
  </div>
</template>
