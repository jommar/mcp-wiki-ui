<script setup>
import { useForceGraph } from '@/composables/useForceGraph.js';
import GraphToolbar from './GraphToolbar.vue';
import GraphLegend from './GraphLegend.vue';
import GraphMinimap from './GraphMinimap.vue';
import NodeTooltip from './NodeTooltip.vue';
import NodeDetailPanel from './NodeDetailPanel.vue';

const props = defineProps({
  nodes: { type: Array, default: () => [] },
  edges: { type: Array, default: () => [] },
  wikiId: String,
  healthIssues: { type: Object, default: () => ({ empty: new Set(), orphaned: new Set() }) },
});

const router = useRouter();
const containerRef = ref(null);

const nodesRef = ref(props.nodes);
const edgesRef = ref(props.edges);
watch(
  () => props.nodes,
  (v) => {
    nodesRef.value = v;
  },
  { immediate: true },
);
watch(
  () => props.edges,
  (v) => {
    edgesRef.value = v;
  },
  { immediate: true },
);
watch(
  () => props.healthIssues,
  (v) => graph.setHealthIssues(v),
  { deep: true },
);

const graph = useForceGraph(containerRef, nodesRef, edgesRef);

watch(graph.navigateTo, (key) => {
  if (!key) return;
  router.push({
    name: 'section',
    params: { key },
    query: props.wikiId ? { wikiId: props.wikiId } : {},
  });
  graph.navigateTo.value = null;
});
</script>

<template>
  <div class="flex flex-col h-full">
    <GraphToolbar
      v-model:filter="graph.filterText.value"
      :layout-mode="graph.layoutMode.value"
      :focus-mode="graph.focusMode.value"
      :zoom-level="graph.zoomLevel.value"
      :node-count="nodes.length"
      :edge-count="edges.length"
      :selected-parent-count="graph.selectedParents.value.size"
      @toggle-layout="graph.toggleLayout()"
      @toggle-focus="graph.toggleFocusMode()"
      @zoom-in="graph.zoomIn()"
      @zoom-out="graph.zoomOut()"
      @reset-zoom="graph.resetZoom()"
      @clear-filter="graph.clearParentFilter()"
    />

    <div class="flex-1 relative overflow-hidden">
      <!-- Loading -->
      <div
        v-if="!nodes.length"
        class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted text-[14px]"
      >
        <div class="w-10 h-10 rounded-full border-2 border-border border-t-accent animate-spin" />
        Building knowledge graph…
      </div>

      <!-- D3 container -->
      <div
        ref="containerRef"
        class="w-full h-full"
        style="background: radial-gradient(circle at 50% 50%, #18181b 0%, #09090b 100%)"
      />

      <!-- Overlays -->
      <NodeTooltip v-if="graph.tooltip.value" :tooltip="graph.tooltip.value" :wiki-id="wikiId" />

      <GraphLegend
        v-if="Object.keys(graph.parentColors.value).length"
        :colors="graph.parentColors.value"
        :selected="graph.selectedParents.value"
        @toggle="
          (p) => {
            const s = new Set(graph.selectedParents.value);
            s.has(p) ? s.delete(p) : s.add(p);
            graph.selectedParents.value = s;
          }
        "
        @clear="graph.clearParentFilter()"
      />

      <GraphMinimap
        :nodes="graph.minimapNodes.value"
        :bounds="graph.minimapBounds.value"
        :colors="graph.parentColors.value"
        @pan-to="({ x, y }) => graph.panTo(x, y)"
      />

      <transition name="slide-right">
        <NodeDetailPanel
          v-if="graph.selectedNode.value"
          :node="graph.selectedNode.value"
          :wiki-id="wikiId"
          :parent-colors="graph.parentColors.value"
          @close="graph.selectedNode.value = null"
          @navigate="
            (key) =>
              router.push({ name: 'section', params: { key }, query: wikiId ? { wikiId } : {} })
          "
        />
      </transition>
    </div>
  </div>
</template>
