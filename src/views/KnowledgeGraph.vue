<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import * as d3 from 'd3';
import { wikiApi } from '../api/wiki.js';

const props = defineProps({ wikiId: String });
const router = useRouter();
const route = useRoute();

const graphContainer = ref(null);
const selectedNode = ref(null);
const backlinks = ref([]);
const loading = ref(true);
const nodes = ref([]);
const edges = ref([]);
const filterText = ref('');
const zoomLevel = ref(1);

// Task 3: Legend state
const legendCollapsed = ref(false);
const parentColors = ref({});
const selectedParents = ref(new Set()); // empty = all selected

// Task 4: Tooltip state
const tooltip = ref(null);
const tooltipSnippet = ref('');
const tooltipLoading = ref(false);
let tooltipTimeout = null;

let svg, simulation, g, zoom;

onMounted(async () => {
  await loadGraph();
  await nextTick();
  initGraph();
});

onUnmounted(() => {
  if (simulation) simulation.stop();
  if (tooltipTimeout) clearTimeout(tooltipTimeout);
});

watch(() => props.wikiId, async () => {
  await loadGraph();
  initGraph();
});

watch(filterText, () => {
  applyFilters();
});

function applyFilters() {
  if (!simulation) return;
  const text = filterText.value.toLowerCase();
  const hasParentFilter = selectedParents.value.size > 0;

  d3.selectAll('.graph-node')
    .attr('opacity', d => {
      const parent = d.parent || 'Root';
      if (hasParentFilter && !selectedParents.value.has(parent)) return 0.08;
      if (!text) return 1;
      return ((d.title || '').toLowerCase().includes(text) || (d.id || '').toLowerCase().includes(text)) ? 1 : 0.15;
    });
  d3.selectAll('.graph-link')
    .attr('opacity', d => {
      const sourceParent = d.source.parent || 'Root';
      const targetParent = d.target.parent || 'Root';
      if (hasParentFilter && !selectedParents.value.has(sourceParent) && !selectedParents.value.has(targetParent)) return 0.03;
      if (!text) return 0.4;
      const sourceTitle = (d.source.title || '').toLowerCase();
      const sourceId = (typeof d.source === 'object' ? (d.source.id || '') : String(d.source)).toLowerCase();
      const targetTitle = (d.target.title || '').toLowerCase();
      const targetId = (typeof d.target === 'object' ? (d.target.id || '') : String(d.target)).toLowerCase();
      return (sourceTitle.includes(text) || sourceId.includes(text) || targetTitle.includes(text) || targetId.includes(text)) ? 0.6 : 0.05;
    });
}

function toggleParentFilter(parent) {
  if (selectedParents.value.has(parent)) {
    selectedParents.value.delete(parent);
    // If all deselected, reset to show all
    if (selectedParents.value.size === 0) {
      selectedParents.value = new Set();
    }
  } else {
    selectedParents.value.add(parent);
  }
  selectedParents.value = new Set(selectedParents.value);
  applyFilters();
}

function clearParentFilter() {
  selectedParents.value = new Set();
  applyFilters();
}

async function loadGraph() {
  loading.value = true;
  try {
    const data = await wikiApi.getGraph(props.wikiId || undefined);
    // Filter out nodes with no content — they have nothing to preview or display
    nodes.value = data.nodes.filter(n => (n.contentLength || 0) > 0);
    edges.value = data.edges.filter(e =>
      nodes.value.some(n => n.id === e.source) && nodes.value.some(n => n.id === e.target),
    );
  } catch (err) {
    console.error('Failed to load graph:', err);
  } finally {
    loading.value = false;
  }
}

// Task 3: Build a deterministic color scale keyed by parent
function buildColorScale(nodeData) {
  const parents = [...new Set(nodeData.map(n => n.parent || 'Root'))].sort();
  const palette = [
    '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e', '#f97316', '#eab308',
    '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
    '#7c3aed', '#c026d3', '#059669', '#dc2626',
    '#2563eb', '#d97706', '#0891b2', '#78716c',
  ];
  const scale = {};
  parents.forEach((p, i) => {
    scale[p] = palette[i % palette.length];
  });
  parentColors.value = scale;
  return d3.scaleOrdinal().domain(parents).range(parents.map(p => scale[p]));
}

function initGraph() {
  if (!graphContainer.value) return;
  const container = graphContainer.value;
  container.innerHTML = '';

  const width = container.clientWidth;
  const height = container.clientHeight;

  svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  const defs = svg.append('defs');

  const glowFilter = defs.append('filter').attr('id', 'glow');
  glowFilter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
  const feMerge = glowFilter.append('feMerge');
  feMerge.append('feMergeNode').attr('in', 'coloredBlur');
  feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

  const gradient = defs.append('linearGradient').attr('id', 'node-gradient').attr('gradientUnits', 'userSpaceOnUse');
  gradient.append('stop').attr('offset', '0%').attr('stop-color', 'var(--gradient-start)');
  gradient.append('stop').attr('offset', '100%').attr('stop-color', 'var(--gradient-end)');

  zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
      zoomLevel.value = event.transform.k;
    });

  svg.call(zoom);

  g = svg.append('g');

  const nodeMap = new Map();
  nodes.value.forEach(n => nodeMap.set(n.id, { ...n }));

  const linkData = edges.value
    .filter(e => nodeMap.has(e.source) && nodeMap.has(e.target))
    .map(e => ({ source: e.source, target: e.target }));

  const nodeData = nodes.value.map(n => nodeMap.get(n.id));

  // Task 3: Color by parent
  const colorScale = buildColorScale(nodeData);

  // Task 2: Compute cluster centers for each parent group
  const parentGroups = {};
  nodeData.forEach(n => {
    const p = n.parent || 'Root';
    if (!parentGroups[p]) parentGroups[p] = [];
    parentGroups[p].push(n);
  });

  const parentKeys = Object.keys(parentGroups);
  const clusterRadius = Math.min(width, height) * 0.32;

  // Position cluster centers in a circle around the viewport center
  const clusterCenters = {};
  parentKeys.forEach((p, i) => {
    const angle = (2 * Math.PI * i) / parentKeys.length - Math.PI / 2;
    clusterCenters[p] = {
      x: width / 2 + clusterRadius * Math.cos(angle),
      y: height / 2 + clusterRadius * Math.sin(angle),
    };
  });

  simulation = d3.forceSimulation(nodeData)
    .force('link', d3.forceLink(linkData).id(d => d.id).distance(100).strength(0.3))
    .force('charge', d3.forceManyBody().strength(-250))
    .force('center', d3.forceCenter(width / 2, height / 2).strength(0.03))
    .force('collision', d3.forceCollide().radius(28))
    // Task 2: Grouping force — pull nodes toward their parent cluster center
    .force('x', d3.forceX(d => clusterCenters[d.parent || 'Root']?.x ?? width / 2).strength(0.12))
    .force('y', d3.forceY(d => clusterCenters[d.parent || 'Root']?.y ?? height / 2).strength(0.12));

  g.append('g')
    .selectAll('line')
    .data(linkData)
    .join('line')
    .attr('class', 'graph-link')
    .attr('stroke', 'var(--border)')
    .attr('stroke-opacity', 0.3)
    .attr('stroke-width', 1.2);

  const nodeGroup = g.append('g')
    .selectAll('g')
    .data(nodeData)
    .join('g')
    .attr('class', 'graph-node')
    .attr('cursor', 'pointer')
    .call(d3.drag()
      .on('start', dragStarted)
      .on('drag', dragged)
      .on('end', dragEnded));

  nodeGroup.append('circle')
    .attr('r', d => Math.max(6, Math.min(16, Math.sqrt(d.contentLength || 500) / 5)))
    .attr('fill', d => colorScale(d.parent || 'Root'))
    .attr('stroke', 'var(--bg-elevated)')
    .attr('stroke-width', 2)
    .attr('filter', 'url(#glow)');

  nodeGroup.append('circle')
    .attr('r', d => Math.max(6, Math.min(16, Math.sqrt(d.contentLength || 500) / 5)) + 4)
    .attr('fill', 'none')
    .attr('stroke', d => colorScale(d.parent || 'Root'))
    .attr('stroke-opacity', 0.15)
    .attr('stroke-width', 1)
    .attr('class', 'node-halo');

  nodeGroup.append('text')
    .attr('dy', d => Math.max(6, Math.min(16, Math.sqrt(d.contentLength || 500) / 5)) + 14)
    .attr('text-anchor', 'middle')
    .attr('fill', 'var(--text)')
    .attr('font-size', '9px')
    .attr('font-weight', '500')
    .attr('pointer-events', 'none')
    .text(d => d.title.length > 20 ? d.title.slice(0, 18) + '...' : d.title);

  // Task 4: Hover-to-peek tooltip
  nodeGroup.on('mouseover', (event, d) => {
    event.stopPropagation();
    if (tooltipTimeout) clearTimeout(tooltipTimeout);
    tooltipTimeout = setTimeout(() => showTooltip(event, d), 300);
  });

  nodeGroup.on('mousemove', (event) => {
    positionTooltip(event);
  });

  nodeGroup.on('mouseout', () => {
    if (tooltipTimeout) clearTimeout(tooltipTimeout);
    hideTooltip();
  });

  nodeGroup.on('click', (event, d) => {
    event.stopPropagation();
    if (tooltipTimeout) clearTimeout(tooltipTimeout);
    hideTooltip();
    selectedNode.value = d;
    loadBacklinks(d.id);
  });

  simulation.on('tick', () => {
    g.selectAll('.graph-link')
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    g.selectAll('.graph-node')
      .attr('transform', d => `translate(${d.x},${d.y})`);
  });

  svg.on('click', () => {
    selectedNode.value = null;
    backlinks.value = [];
  });
}

// Task 4: Tooltip helpers
async function showTooltip(event, d) {
  tooltipLoading.value = true;
  tooltipSnippet.value = '';
  tooltip.value = { x: event.pageX, y: event.pageY, title: d.title, key: d.id };

  try {
    const data = await wikiApi.getSection(d.id, props.wikiId, 0, 150);
    tooltipSnippet.value = (data.content || '').slice(0, 150).trim();
  } catch {
    tooltipSnippet.value = 'Unable to load preview';
  } finally {
    tooltipLoading.value = false;
  }
}

function positionTooltip(event) {
  if (!tooltip.value) return;
  tooltip.value.x = event.pageX + 16;
  tooltip.value.y = event.pageY - 10;
}

function hideTooltip() {
  tooltip.value = null;
  tooltipSnippet.value = '';
  tooltipLoading.value = false;
}

async function loadBacklinks(key) {
  try {
    const data = await wikiApi.getBacklinks(key, props.wikiId);
    backlinks.value = data.backlinks || [];
  } catch (err) {
    console.error('Failed to load backlinks:', err);
  }
}

function dragStarted(event, d) {
  if (!event.active) simulation.alphaTarget(0.3).restart();
  d.fx = d.x;
  d.fy = d.y;
}

function dragged(event, d) {
  d.fx = event.x;
  d.fy = event.y;
}

function dragEnded(event, d) {
  if (!event.active) simulation.alphaTarget(0);
  d.fx = null;
  d.fy = null;
}

function zoomIn() {
  svg.transition().call(zoom.scaleBy, 1.3);
}

function zoomOut() {
  svg.transition().call(zoom.scaleBy, 0.7);
}

function resetZoom() {
  svg.transition().call(zoom.transform, d3.zoomIdentity);
}

function navigateToSection(key) {
  router.push({ name: 'section', params: { sectionKey: key }, query: props.wikiId ? { wikiId: props.wikiId } : {} });
}
</script>

<template>
  <div class="graph-layout">
    <div class="graph-toolbar">
      <div class="search-wrapper">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          v-model="filterText"
          type="text"
          placeholder="Filter nodes..."
          class="filter-input"
        />
      </div>
      <div class="zoom-controls">
        <button class="zoom-btn" @click="zoomIn">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        </button>
        <span class="zoom-level">{{ Math.round(zoomLevel * 100) }}%</span>
        <button class="zoom-btn" @click="zoomOut">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/></svg>
        </button>
        <button class="zoom-btn reset" @click="resetZoom">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 1 3 6.75"/><path d="M3 21v-6h6"/></svg>
        </button>
      </div>
      <div class="graph-stats">
        <span class="stat-pill">{{ nodes.length }} nodes</span>
        <span class="stat-pill">{{ edges.length }} links</span>
        <button v-if="selectedParents.size > 0" class="clear-filter-btn" @click="clearParentFilter">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          <span>{{ selectedParents.size }} topic{{ selectedParents.size > 1 ? 's' : '' }} filtered</span>
        </button>
      </div>
    </div>

    <div class="graph-content">
      <div v-if="loading" class="graph-loading">
        <div class="loading-spinner" />
        <span>Building knowledge graph...</span>
      </div>
      <div ref="graphContainer" v-show="!loading" class="graph-container" />

      <!-- Task 4: Hover tooltip -->
      <div v-if="tooltip" class="graph-tooltip" :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }">
        <div class="tooltip-title">{{ tooltip.title }}</div>
        <code class="tooltip-key">{{ tooltip.key }}</code>
        <div v-if="tooltipLoading" class="tooltip-loading">
          <div class="tooltip-spinner" />
          <span>Loading preview...</span>
        </div>
        <p v-else class="tooltip-snippet">{{ tooltipSnippet || 'No content available' }}</p>
      </div>

      <!-- Task 3: Collapsible legend -->
      <div v-if="Object.keys(parentColors).length" class="graph-legend">
        <div class="legend-header">
          <button class="legend-toggle" @click="legendCollapsed = !legendCollapsed">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"
              :class="{ 'legend-collapsed': legendCollapsed }">
              <path d="M6 9l6 6 6-6"/>
            </svg>
            <span>{{ legendCollapsed ? 'Legend' : 'Topic Colors' }}</span>
          </button>
          <button v-if="selectedParents.size > 0" class="legend-clear-icon" @click="clearParentFilter" title="Clear filter">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <transition name="legend-expand">
          <div v-show="!legendCollapsed" class="legend-items">
            <div
              v-for="(color, parent) in parentColors"
              :key="parent"
              class="legend-item"
              :class="{ 'legend-active': selectedParents.size === 0 || selectedParents.has(parent) }"
              @click="toggleParentFilter(parent)"
            >
              <span class="legend-dot" :style="{ background: color }" />
              <span class="legend-label">{{ parent }}</span>
            </div>
          </div>
        </transition>
      </div>

      <transition name="slide-panel">
        <div v-if="selectedNode" class="detail-panel">
          <div class="panel-header">
            <div class="panel-title-area">
              <span class="panel-dot" :style="{ background: parentColors[selectedNode.parent || 'Root'] || 'var(--text-muted)' }" />
              <h3>{{ selectedNode.title }}</h3>
            </div>
            <button class="close-btn" @click="selectedNode = null; backlinks = []">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div class="panel-meta">
            <code class="meta-key">{{ selectedNode.id }}</code>
            <span class="meta-parent">{{ selectedNode.parent }}</span>
          </div>
          <button class="view-btn" @click="navigateToSection(selectedNode.id)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            View Content
          </button>

          <div class="backlinks-section">
            <h4>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              Incoming Links ({{ backlinks.length }})
            </h4>
            <ul v-if="backlinks.length" class="backlink-list">
              <li v-for="bl in backlinks" :key="bl.key" class="backlink-item">
                <a href="#" @click.prevent="navigateToSection(bl.key)">
                  <span class="bl-title">{{ bl.title }}</span>
                  <span class="bl-parent">{{ bl.parent }}</span>
                </a>
              </li>
            </ul>
            <div v-else class="no-backlinks">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 15s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/></svg>
              <p>No incoming links</p>
            </div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<style scoped>
.graph-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.graph-toolbar {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  gap: 12px;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-elevated);
}

.search-wrapper {
  flex: 1;
  max-width: 320px;
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  width: 16px;
  height: 16px;
  color: var(--text-muted);
  pointer-events: none;
}

.filter-input {
  width: 100%;
  padding: 9px 12px 9px 38px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg);
  color: var(--text);
  font-size: 13px;
  transition: var(--transition);
}

.filter-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-bg);
}

.filter-input::placeholder {
  color: var(--text-muted);
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--bg);
  padding: 4px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
}

.zoom-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition);
}

.zoom-btn:hover {
  background: var(--accent-bg);
  color: var(--accent);
}

.zoom-btn.reset {
  width: auto;
  padding: 0 8px;
  font-size: 12px;
}

.zoom-level {
  font-size: 12px;
  color: var(--text-muted);
  min-width: 44px;
  text-align: center;
  font-weight: 500;
  font-family: var(--mono);
}

.graph-stats {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.stat-pill {
  font-size: 12px;
  color: var(--text-muted);
  background: var(--bg);
  padding: 6px 12px;
  border-radius: 20px;
  border: 1px solid var(--border);
  font-weight: 500;
  font-family: var(--mono);
}

.clear-filter-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--danger-border, #fca5a5);
  background: var(--danger-bg, #fef2f2);
  color: var(--danger, #ef4444);
  border-radius: 20px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition: var(--transition);
}

.clear-filter-btn:hover {
  background: var(--danger, #ef4444);
  color: white;
  border-color: var(--danger, #ef4444);
}

.graph-content {
  flex: 1;
  display: flex;
  position: relative;
  overflow: hidden;
}

.graph-container {
  flex: 1;
  background: var(--bg);
}

.graph-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--text-muted);
  font-size: 14px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Task 4: Tooltip styles */
.graph-tooltip {
  position: fixed;
  z-index: 200;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  max-width: 300px;
  box-shadow: var(--shadow-xl);
  pointer-events: none;
  transition: opacity 0.15s;
}

.tooltip-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-h);
  margin-bottom: 4px;
}

.tooltip-key {
  font-size: 11px;
  color: var(--accent);
  font-family: var(--mono);
  display: block;
  margin-bottom: 8px;
}

.tooltip-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
}

.tooltip-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.tooltip-snippet {
  font-size: 12px;
  color: var(--text);
  line-height: 1.5;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Task 3: Legend styles */
.graph-legend {
  position: absolute;
  bottom: 16px;
  left: 16px;
  z-index: 50;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  max-width: 220px;
}

.legend-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px 0 0;
}

.legend-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition: var(--transition);
}

.legend-toggle:hover {
  background: var(--accent-bg);
  color: var(--accent);
}

.legend-toggle svg {
  transition: transform 0.2s;
}

.legend-collapsed {
  transform: rotate(-90deg);
}

.legend-clear-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--danger, #ef4444);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: var(--transition);
  flex-shrink: 0;
}

.legend-clear-icon:hover {
  background: var(--danger-bg, #fef2f2);
}

.legend-items {
  padding: 4px 8px 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 300px;
  overflow-y: auto;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 4px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition);
  user-select: none;
}

.legend-item:hover {
  background: var(--accent-bg);
}

.legend-item:not(.legend-active) {
  opacity: 0.3;
}

.legend-item:not(.legend-active):hover {
  opacity: 0.6;
}

.legend-clear-btn {
  margin-top: 4px;
  padding: 4px 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--accent);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  transition: var(--transition);
}

.legend-clear-btn:hover {
  background: var(--accent-bg);
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-label {
  font-size: 11px;
  color: var(--text);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.legend-expand-enter-active,
.legend-expand-leave-active {
  transition: max-height 0.25s ease, opacity 0.2s;
  overflow: hidden;
}

.legend-expand-enter-from,
.legend-expand-leave-to {
  max-height: 0;
  opacity: 0;
}

.legend-expand-enter-to,
.legend-expand-leave-from {
  max-height: 300px;
  opacity: 1;
}

.detail-panel {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 340px;
  background: var(--bg-elevated);
  border-left: 1px solid var(--border);
  padding: 20px;
  overflow-y: auto;
  box-shadow: var(--shadow-xl);
  z-index: 10;
}

.slide-panel-enter-active,
.slide-panel-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s;
}

.slide-panel-enter-from,
.slide-panel-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: 12px;
}

.panel-title-area {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.panel-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.panel-header h3 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-h);
  margin: 0;
  line-height: 1.3;
}

.close-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  transition: var(--transition);
  flex-shrink: 0;
}

.close-btn:hover {
  background: var(--danger-bg);
  color: var(--danger);
}

.panel-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 16px;
}

.meta-key {
  font-size: 12px;
  color: var(--accent);
  font-family: var(--mono);
  font-weight: 500;
}

.meta-parent {
  font-size: 12px;
  color: var(--text-muted);
}

.view-btn {
  width: 100%;
  padding: 10px 16px;
  border: 1px solid var(--accent-border);
  background: var(--accent-bg);
  color: var(--accent);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 20px;
  transition: var(--transition);
}

.view-btn:hover {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.backlinks-section h4 {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-h);
  margin: 0 0 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.backlink-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.backlink-item {
  margin-bottom: 4px;
}

.backlink-item a {
  display: flex;
  flex-direction: column;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  text-decoration: none;
  transition: var(--transition);
  border: 1px solid transparent;
}

.backlink-item a:hover {
  background: var(--accent-bg);
  border-color: var(--accent-border);
  text-decoration: none;
}

.bl-title {
  font-size: 13px;
  color: var(--text-h);
  font-weight: 500;
}

.bl-parent {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.no-backlinks {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 0;
  color: var(--text-muted);
}

.no-backlinks svg {
  opacity: 0.4;
}

.no-backlinks p {
  font-size: 13px;
  margin: 0;
}
</style>
