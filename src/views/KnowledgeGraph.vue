<script setup>
import { api } from '@/api/wiki.js';
import ForceGraph from '@/components/graph/ForceGraph.vue';

const props = defineProps({ wikiId: String });

const nodes = ref([]);
const edges = ref([]);
const healthIssues = ref({ empty: new Set(), orphaned: new Set() });

async function load() {
  try {
    const [graph, health] = await Promise.all([
      api.graph(props.wikiId || undefined),
      api.validate(props.wikiId || undefined),
    ]);
    nodes.value = graph.nodes;
    edges.value = graph.edges;
    healthIssues.value = {
      empty: new Set((health.emptySections || []).map((s) => s.key)),
      orphaned: new Set((health.orphanedSections || []).map((s) => s.key)),
    };
  } catch (e) {
    console.error('Graph load failed:', e);
  }
}

onMounted(load);
watch(() => props.wikiId, load);
</script>

<template>
  <div class="h-full">
    <ForceGraph :nodes="nodes" :edges="edges" :wiki-id="wikiId" :health-issues="healthIssues" />
  </div>
</template>
