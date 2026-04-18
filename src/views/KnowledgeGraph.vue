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

// Legend state
const legendCollapsed = ref(false);
const parentColors = ref({});
const selectedParents = ref(new Set());

// Tooltip state
const tooltip = ref(null);
const tooltipSnippet = ref('');
const tooltipLoading = ref(false);
let tooltipTimeout = null;

// Focus mode state
const focusMode = ref(false);
const focusedNodeId = ref(null);

// Health data
const healthIssues = ref({ empty: new Set(), orphaned: new Set() });

// Layout mode
const layoutMode = ref('force'); // 'force' or 'tree'

// Mini-map

// Command palette
const cmdPaletteOpen = ref(false);
const cmdQuery = ref('');
const cmdResults = ref([]);
const cmdLoading = ref(false);
const cmdSelectedIdx = ref(0);
const cmdInput = ref(null);

let svg, simulation, g, zoom, minimapSvg, minimapG;

onMounted(async () => {
  await loadGraph();
  await loadHealth();
  await nextTick();
  initGraph();
  initMinimap();
  document.addEventListener('keydown', handleGlobalKeydown);
});

onUnmounted(() => {
  if (simulation) simulation.stop();
  if (tooltipTimeout) clearTimeout(tooltipTimeout);
  document.removeEventListener('keydown', handleGlobalKeydown);
});

watch(() => props.wikiId, async () => {
  await loadGraph();
  await loadHealth();
  initGraph();
  initMinimap();
});

watch(filterText, () => {
  applyFilters();
});

function handleGlobalKeydown(e) {
  // Cmd+K or Ctrl+K to open command palette
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    cmdPaletteOpen.value = !cmdPaletteOpen.value;
    if (cmdPaletteOpen.value) {
      cmdQuery.value = '';
      cmdResults.value = [];
      cmdSelectedIdx.value = 0;
      nextTick(() => cmdInput.value?.focus());
    }
  }
  // Escape to close palette
  if (e.key === 'Escape' && cmdPaletteOpen.value) {
    cmdPaletteOpen.value = false;
  }
  // Arrow navigation in palette
  if (cmdPaletteOpen.value) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      cmdSelectedIdx.value = Math.min(cmdSelectedIdx.value + 1, cmdResults.value.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      cmdSelectedIdx.value = Math.max(cmdSelectedIdx.value - 1, 0);
    } else if (e.key === 'Enter' && cmdResults.value[cmdSelectedIdx.value]) {
      e.preventDefault();
      navigateToSection(cmdResults.value[cmdSelectedIdx.value].key);
      cmdPaletteOpen.value = false;
    }
  }
}

async function loadHealth() {
  try {
    const data = await wikiApi.validate(props.wikiId || undefined);
    healthIssues.value = {
      empty: new Set((data.emptySections || []).map(s => s.key)),
      orphaned: new Set((data.orphanedSections || []).map(s => s.key)),
    };
  } catch {
    healthIssues.value = { empty: new Set(), orphaned: new Set() };
  }
}

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

function buildColorScale(nodeData) {
  const parents = [...new Set(nodeData.map(n => n.parent || 'Root'))].sort();
const palette = [
    // Bright, saturated colors that pop on dark backgrounds
    '#ff6b6b', // bright coral
    '#ffd93d', // bright yellow
    '#6bcb77', // bright green
    '#4d96ff', // bright blue
    '#ff8ff8', // bright pink
    '#00d2d3', // bright cyan
    '#ff9f43', // bright orange
    '#a29bfe', // light purple
    '#fd79a8', // hot pink
    '#fab1a0', // peach
    '#81ecec', // light teal
    '#dfe6e9', // off-white
    '#fdcb6e', // golden yellow
    '#e17055', // burnt orange
    '#74b9ff', // sky blue
    '#d63031', // bright red
    '#00b894', // emerald
    '#e84393', // magenta
    '#0984e3', // vivid blue
    '#b2bec3', // light gray
  ];
  const scale = {};
  parents.forEach((p, i) => {
    scale[p] = palette[i % palette.length];
  });
  parentColors.value = scale;
  return d3.scaleOrdinal().domain(parents).range(parents.map(p => scale[p]));
}

// Compute centrality (link count) for each node
function computeCentrality(nodeData, linkData) {
  const counts = new Map();
  nodeData.forEach(n => counts.set(n.id, 0));
  linkData.forEach(l => {
    const sid = typeof l.source === 'object' ? l.source.id : l.source;
    const tid = typeof l.target === 'object' ? l.target.id : l.target;
    counts.set(sid, (counts.get(sid) || 0) + 1);
    counts.set(tid, (counts.get(tid) || 0) + 1);
  });
  return counts;
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
    .attr('height', height)
    .style('background', 'transparent');

  const defs = svg.append('defs');

  // Glow filter
  const glowFilter = defs.append('filter').attr('id', 'glow');
  glowFilter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
  const feMerge = glowFilter.append('feMerge');
  feMerge.append('feMergeNode').attr('in', 'coloredBlur');
  feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

  // Stronger glow for focus/highlight
  const strongGlow = defs.append('filter').attr('id', 'strong-glow');
  strongGlow.append('feGaussianBlur').attr('stdDeviation', '6').attr('result', 'coloredBlur');
  const feMerge2 = strongGlow.append('feMerge');
  feMerge2.append('feMergeNode').attr('in', 'coloredBlur');
  feMerge2.append('feMergeNode').attr('in', 'coloredBlur');
  feMerge2.append('feMergeNode').attr('in', 'SourceGraphic');

  // Radial gradients for each parent color (created dynamically)
  const colorScale = buildColorScale(nodes.value);
  const parents = [...new Set(nodes.value.map(n => n.parent || 'Root'))];
  parents.forEach(p => {
    const color = colorScale(p);
    const grad = defs.append('radialGradient')
      .attr('id', `radial-${p.replace(/[^a-zA-Z0-9]/g, '_')}`)
      .attr('cx', '35%').attr('cy', '35%').attr('r', '65%');
    grad.append('stop').attr('offset', '0%').attr('stop-color', d3.color(color).brighter(0.8));
    grad.append('stop').attr('offset', '60%').attr('stop-color', color);
    grad.append('stop').attr('offset', '100%').attr('stop-color', d3.color(color).darker(0.5));
  });

  // Health warning pulse gradient
  const healthGrad = defs.append('radialGradient').attr('id', 'health-warning')
    .attr('cx', '50%').attr('cy', '50%').attr('r', '50%');
  healthGrad.append('stop').attr('offset', '0%').attr('stop-color', '#f59e0b').attr('stop-opacity', 0.8);
  healthGrad.append('stop').attr('offset', '100%').attr('stop-color', '#ef4444').attr('stop-opacity', 0.2);

  zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
      zoomLevel.value = event.transform.k;
      updateMinimapViewport();
    });

  svg.call(zoom);

  g = svg.append('g');

  const nodeMap = new Map();
  nodes.value.forEach(n => nodeMap.set(n.id, { ...n }));

  const linkData = edges.value
    .filter(e => nodeMap.has(e.source) && nodeMap.has(e.target))
    .map(e => ({ source: e.source, target: e.target }));

  const nodeData = nodes.value.map(n => nodeMap.get(n.id));

  // Compute centrality
  const centrality = computeCentrality(nodeData, linkData);
  nodeData.forEach(n => { n.centrality = centrality.get(n.id) || 0; });

  // Node radius based on centrality
  const maxCentrality = Math.max(...nodeData.map(n => n.centrality), 1);
  nodeData.forEach(n => {
    n.radius = 5 + (n.centrality / maxCentrality) * 14; // 5-19px range
  });

  // Build adjacency for focus mode
  const adjacency = new Map();
  nodeData.forEach(n => adjacency.set(n.id, new Set()));
  linkData.forEach(l => {
    const sid = typeof l.source === 'object' ? l.source.id : l.source;
    const tid = typeof l.target === 'object' ? l.target.id : l.target;
    adjacency.get(sid).add(tid);
    adjacency.get(tid).add(sid);
  });

  // Cluster centers for grouping
  const parentGroups = {};
  nodeData.forEach(n => {
    const p = n.parent || 'Root';
    if (!parentGroups[p]) parentGroups[p] = [];
    parentGroups[p].push(n);
  });

  const parentKeys = Object.keys(parentGroups);
  const clusterRadius = Math.min(width, height) * 0.32;
  const clusterCenters = {};
  parentKeys.forEach((p, i) => {
    const angle = (2 * Math.PI * i) / parentKeys.length - Math.PI / 2;
    clusterCenters[p] = {
      x: width / 2 + clusterRadius * Math.cos(angle),
      y: height / 2 + clusterRadius * Math.sin(angle),
    };
  });

  // --- LINKS: Curved Bezier paths ---
  const linkGroup = g.append('g').selectAll('path')
    .data(linkData)
    .join('path')
    .attr('class', 'graph-link')
    .attr('fill', 'none')
    .attr('stroke', 'var(--border)')
    .attr('stroke-opacity', 0.25)
    .attr('stroke-width', 1.2);

  // --- NODES ---
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

  // Outer glow ring (centrality-based)
  nodeGroup.append('circle')
    .attr('class', 'node-glow')
    .attr('r', d => d.radius + 5)
    .attr('fill', 'none')
    .attr('stroke', d => colorScale(d.parent || 'Root'))
    .attr('stroke-opacity', d => 0.05 + (d.centrality / maxCentrality) * 0.2)
    .attr('stroke-width', d => 1 + (d.centrality / maxCentrality) * 3);

  // Main node circle with radial gradient
  nodeGroup.append('circle')
    .attr('class', 'node-main')
    .attr('r', d => d.radius)
    .attr('fill', d => {
      const p = d.parent || 'Root';
      return `url(#radial-${p.replace(/[^a-zA-Z0-9]/g, '_')})`;
    })
    .attr('stroke', 'var(--bg)')
    .attr('stroke-width', 1.5)
    .attr('filter', d => d.centrality > maxCentrality * 0.5 ? 'url(#strong-glow)' : 'url(#glow)');

  // Health warning ring for empty/orphaned nodes
  nodeGroup.filter(d => healthIssues.value.empty.has(d.id) || healthIssues.value.orphaned.has(d.id))
    .append('circle')
    .attr('class', 'health-ring')
    .attr('r', d => d.radius + 3)
    .attr('fill', 'none')
    .attr('stroke', d => healthIssues.value.empty.has(d.id) ? '#ef4444' : '#f59e0b')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '3,3')
    .attr('stroke-opacity', 0.8);

  // Pulsing dot for health issues
  nodeGroup.filter(d => healthIssues.value.empty.has(d.id) || healthIssues.value.orphaned.has(d.id))
    .append('circle')
    .attr('class', 'health-pulse-dot')
    .attr('cx', d => d.radius * 0.7)
    .attr('cy', d => -d.radius * 0.7)
    .attr('r', 3)
    .attr('fill', d => healthIssues.value.empty.has(d.id) ? '#ef4444' : '#f59e0b')
    .attr('opacity', 0.8);

  // Node labels
  nodeGroup.append('text')
    .attr('class', 'node-label')
    .attr('dy', d => d.radius + 14)
    .attr('text-anchor', 'middle')
    .attr('fill', 'var(--text)')
    .attr('font-size', '9px')
    .attr('font-weight', '500')
    .attr('pointer-events', 'none')
    .text(d => d.title.length > 20 ? d.title.slice(0, 18) + '...' : d.title);

  // --- Hover interactions: always light up connected edges ---
  nodeGroup.on('mouseover', (event, d) => {
    event.stopPropagation();
    // When a node is selected, keep its neighbors highlighted but show hovered node's tooltip
    if (selectedNode.value) {
      highlightNeighbors(selectedNode.value.id, adjacency);
      if (tooltipTimeout) clearTimeout(tooltipTimeout);
      tooltipTimeout = setTimeout(() => showTooltip(event, d), 300);
      return;
    }
    highlightNeighbors(d.id, adjacency);
    if (tooltipTimeout) clearTimeout(tooltipTimeout);
    tooltipTimeout = setTimeout(() => showTooltip(event, d), 300);
  });

  nodeGroup.on('mousemove', (event) => {
    positionTooltip(event);
  });

  nodeGroup.on('mouseout', () => {
    // If a node is selected, keep its connected neighbors highlighted
    if (selectedNode.value) {
      highlightNeighbors(selectedNode.value.id, adjacency);
    } else if (focusMode.value) {
      // In focus mode: fully reset (dim everything back)
      resetFocusHighlight();
    } else {
      // Normal mode: just reset links/nodes to default
      resetHoverHighlight();
    }
    if (tooltipTimeout) clearTimeout(tooltipTimeout);
    hideTooltip();
  });

  nodeGroup.on('click', (event, d) => {
    event.stopPropagation();
    if (tooltipTimeout) clearTimeout(tooltipTimeout);
    hideTooltip();
    selectedNode.value = d;
    loadBacklinks(d.id);
    // Keep connected nodes highlighted like hover effect
    highlightNeighbors(d.id, adjacency);
  });

  // --- Simulation ---
  simulation = d3.forceSimulation(nodeData)
    .force('link', d3.forceLink(linkData).id(d => d.id).distance(100).strength(0.3))
    .force('charge', d3.forceManyBody().strength(-250))
    .force('center', d3.forceCenter(width / 2, height / 2).strength(0.03))
    .force('collision', d3.forceCollide().radius(d => d.radius + 8))
    .force('x', d3.forceX(d => clusterCenters[d.parent || 'Root']?.x ?? width / 2).strength(0.12))
    .force('y', d3.forceY(d => clusterCenters[d.parent || 'Root']?.y ?? height / 2).strength(0.12));

  simulation.on('tick', () => {
    // Curved link paths
    linkGroup.attr('d', d => {
      const dx = d.target.x - d.source.x;
      const dy = d.target.y - d.source.y;
      const dr = Math.sqrt(dx * dx + dy * dy) * 1.2;
      return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
    });

    nodeGroup.attr('transform', d => `translate(${d.x},${d.y})`);

    // Update minimap
    updateMinimapData(nodeData);
  });

  svg.on('click', () => {
    selectedNode.value = null;
    backlinks.value = [];
    resetHoverHighlight();
  });

  // Store references for layout transitions
  svg.__nodeData = nodeData;
  svg.__linkData = linkData;
  svg.__width = width;
  svg.__height = height;
  svg.__clusterCenters = clusterCenters;
  svg.__linkGroup = linkGroup;
  svg.__nodeGroup = nodeGroup;
  svg.__colorScale = colorScale;
  svg.__maxCentrality = maxCentrality;
  svg.__adjacency = adjacency;

  // Update minimap initial data
  updateMinimapData(nodeData);
}

// --- Focus Mode ---
function highlightNeighbors(nodeId, adjacency) {
  const neighbors = adjacency.get(nodeId) || new Set();
  neighbors.add(nodeId);

  // Dim non-connected nodes (subtle — still visible for context)
  d3.selectAll('.graph-node')
    .transition().duration(200)
    .attr('opacity', d => neighbors.has(d.id) ? 1 : 0.2);

  // Light up connected edges
  d3.selectAll('.graph-link')
    .transition().duration(200)
    .attr('stroke-opacity', d => {
      const sid = typeof d.source === 'object' ? d.source.id : d.source;
      const tid = typeof d.target === 'object' ? d.target.id : d.target;
      return (sid === nodeId || tid === nodeId) ? 0.9 : 0.06;
    })
    .attr('stroke', d => {
      const sid = typeof d.source === 'object' ? d.source.id : d.source;
      const tid = typeof d.target === 'object' ? d.target.id : d.target;
      return (sid === nodeId || tid === nodeId) ? '#818cf8' : 'var(--border)';
    })
    .attr('stroke-width', d => {
      const sid = typeof d.source === 'object' ? d.source.id : d.source;
      const tid = typeof d.target === 'object' ? d.target.id : d.target;
      return (sid === nodeId || tid === nodeId) ? 2.5 : 1;
    });

  // Highlight the hovered node
  d3.selectAll('.graph-node')
    .filter(d => d.id === nodeId)
    .select('.node-main')
    .attr('filter', 'url(#strong-glow)');

  // Focus mode: dim unrelated nodes even more aggressively
  if (focusMode.value) {
    d3.selectAll('.graph-node')
      .transition().duration(200)
      .attr('opacity', d => neighbors.has(d.id) ? 1 : 0.06);
  }
}

function resetFocusHighlight() {
  d3.selectAll('.graph-node')
    .transition().duration(300)
    .attr('opacity', 1);

  d3.selectAll('.graph-link')
    .transition().duration(300)
    .attr('stroke-opacity', 0.25)
    .attr('stroke', 'var(--border)')
    .attr('stroke-width', 1.2);

  // Reset glow
  d3.selectAll('.graph-node')
    .select('.node-main')
    .attr('filter', d => {
      const maxC = svg?.__maxCentrality || 1;
      return d.centrality > maxC * 0.5 ? 'url(#strong-glow)' : 'url(#glow)';
    });
}

// Reset hover highlight only (links and nodes back to default)
function resetHoverHighlight() {
  d3.selectAll('.graph-link')
    .transition().duration(300)
    .attr('stroke-opacity', 0.25)
    .attr('stroke', 'var(--border)')
    .attr('stroke-width', 1.2);

  // Reset node opacity
  d3.selectAll('.graph-node')
    .transition().duration(300)
    .attr('opacity', 1);

  // Reset node glow
  d3.selectAll('.graph-node')
    .select('.node-main')
    .attr('filter', d => {
      const maxC = svg?.__maxCentrality || 1;
      return d.centrality > maxC * 0.5 ? 'url(#strong-glow)' : 'url(#glow)';
    });
}

function toggleFocusMode() {
  focusMode.value = !focusMode.value;
  if (!focusMode.value) {
    resetFocusHighlight();
  }
}

// --- Layout Toggle ---
function toggleLayout() {
  layoutMode.value = layoutMode.value === 'force' ? 'tree' : 'force';
  applyLayout();
}

function applyLayout() {
  if (!svg) return;
  const nodeData = svg.__nodeData;
  const linkData = svg.__linkData;
  const width = svg.__width;
  const height = svg.__height;
  const clusterCenters = svg.__clusterCenters;

  if (layoutMode.value === 'tree') {
    // Tree layout: arrange nodes in a hierarchical tree pattern
    const root = { id: '__root__', x: width / 2, y: 60, depth: 0 };
    const treeNodes = [root];
    const treeLinks = [];

    // Build tree from parent relationships
    const byParent = {};
    nodeData.forEach(n => {
      const p = n.parent || 'Root';
      if (!byParent[p]) byParent[p] = [];
      byParent[p].push(n);
    });

    const parentKeys = Object.keys(byParent).sort();
    const angleStep = (2 * Math.PI) / parentKeys.length;

    parentKeys.forEach((p, i) => {
      const angle = angleStep * i - Math.PI / 2;
      const px = width / 2 + 200 * Math.cos(angle);
      const py = height / 2 + 200 * Math.sin(angle);
      const parentNode = { id: `__cluster_${p}__`, x: px, y: py, depth: 1, label: p };
      treeNodes.push(parentNode);
      treeLinks.push({ source: root, target: parentNode });

      const children = byParent[p];
      const childAngleStep = (2 * Math.PI) / Math.max(children.length, 1);
      children.forEach((child, j) => {
        const ca = angle + childAngleStep * (j - children.length / 2) * 0.3;
        const cr = 120 + Math.random() * 40;
        child.x = px + cr * Math.cos(ca);
        child.y = py + cr * Math.sin(ca);
        child.depth = 2;
        treeLinks.push({ source: parentNode, target: child });
      });
    });

    // Animate nodes to tree positions
    nodeData.forEach(n => {
      const target = treeNodes.find(t => t.id === n.id);
      if (target) {
        n.fx = target.x;
        n.fy = target.y;
      }
    });

    simulation
      .force('link', d3.forceLink(linkData).id(d => d.id).distance(60).strength(0.8))
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', null)
      .force('x', null)
      .force('y', null)
      .alpha(0.5)
      .restart();

    // After settling, fix positions
    setTimeout(() => {
      nodeData.forEach(n => { n.fx = n.x; n.fy = n.y; });
      simulation.alpha(0).stop();
    }, 1500);

  } else {
    // Back to force-directed
    nodeData.forEach(n => { n.fx = null; n.fy = null; });

    simulation
      .force('link', d3.forceLink(linkData).id(d => d.id).distance(100).strength(0.3))
      .force('charge', d3.forceManyBody().strength(-250))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.03))
      .force('x', d3.forceX(d => clusterCenters[d.parent || 'Root']?.x ?? width / 2).strength(0.12))
      .force('y', d3.forceY(d => clusterCenters[d.parent || 'Root']?.y ?? height / 2).strength(0.12))
      .alpha(0.8)
      .restart();
  }
}

// --- Tooltip ---
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
  if (layoutMode.value === 'force') {
    d.fx = null;
    d.fy = null;
  }
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

// --- Command Palette ---
async function searchCommandPalette() {
  if (!cmdQuery.value.trim()) {
    cmdResults.value = [];
    return;
  }
  cmdLoading.value = true;
  try {
    const data = await wikiApi.search(cmdQuery.value, props.wikiId, true, 15);
    cmdResults.value = data.results || [];
    cmdSelectedIdx.value = 0;
  } catch {
    cmdResults.value = [];
  } finally {
    cmdLoading.value = false;
  }
}

// --- Mini-map ---
let minimapBounds = { xMin: 0, yMin: 0, xMax: 1, yMax: 1, scale: 1 };
let minimapInitialized = false;
let minimapDragging = false;

function initMinimap() {
  const minimapEl = document.getElementById('minimap-container');
  if (!minimapEl) return;
  minimapEl.innerHTML = '';

  const mw = 180, mh = 120;
  minimapSvg = d3.select(minimapEl).append('svg')
    .attr('width', mw).attr('height', mh)
    .style('background', 'transparent')
    .style('cursor', 'grab');

  minimapG = minimapSvg.append('g');

  // Viewport indicator (draggable)
  minimapG.append('rect')
    .attr('class', 'minimap-viewport')
    .attr('fill', 'rgba(129, 140, 248, 0.12)')
    .attr('stroke', '#818cf8')
    .attr('stroke-width', 1.5)
    .attr('rx', 2)
    .attr('x', 0).attr('y', 0).attr('width', mw).attr('height', mh)
    .style('cursor', 'grab');

  // Transparent overlay for click/drag on empty areas
  minimapG.append('rect')
    .attr('class', 'minimap-overlay')
    .attr('x', 0).attr('y', 0).attr('width', mw).attr('height', mh)
    .attr('fill', 'transparent')
    .style('cursor', 'crosshair');

  // Drag behavior on the overlay
  const minimapDrag = d3.drag()
    .on('start', (event) => {
      minimapDragging = true;
      minimapSvg.style('cursor', 'grabbing');
      panMinimapToEvent(event);
    })
    .on('drag', (event) => {
      panMinimapToEvent(event);
    })
    .on('end', () => {
      minimapDragging = false;
      minimapSvg.style('cursor', 'grab');
    });

  minimapG.select('.minimap-overlay').call(minimapDrag);

  // Also make the viewport rect draggable
  const viewportDrag = d3.drag()
    .on('start', (event) => {
      minimapDragging = true;
      minimapSvg.style('cursor', 'grabbing');
    })
    .on('drag', (event) => {
      panMinimapToEvent(event);
    })
    .on('end', () => {
      minimapDragging = false;
      minimapSvg.style('cursor', 'grab');
    });

  minimapG.select('.minimap-viewport').call(viewportDrag);

  minimapInitialized = true;
}

function panMinimapToEvent(event) {
  if (!minimapBounds.scale || !svg) return;
  const { xMin, yMin, scale, cw, ch, padding } = minimapBounds;

  // Minimap position to graph coordinates
  const graphX = (event.x - padding) / scale + xMin;
  const graphY = (event.y - padding) / scale + yMin;

  // Center the viewport on this point
  svg.call(zoom.translateTo, graphX, graphY);
}

function updateMinimapData(nodeData) {
  if (!minimapG || !minimapInitialized) return;
  const mw = 180, mh = 120;
  const container = graphContainer.value;
  if (!container) return;
  const cw = container.clientWidth, ch = container.clientHeight;

  const xs = nodeData.map(n => n.x).filter(v => v != null);
  const ys = nodeData.map(n => n.y).filter(v => v != null);
  if (!xs.length) return;

  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const padding = 8;
  const scaleX = (mw - padding * 2) / (xMax - xMin || 1);
  const scaleY = (mh - padding * 2) / (yMax - yMin || 1);
  const scale = Math.min(scaleX, scaleY);

  minimapBounds = { xMin, yMin, xMax, yMax, scale, cw, ch, padding, mw, mh };

  // Use D3 join for efficient updates (no remove/recreate)
  const circles = minimapG.selectAll('.minimap-node')
    .data(nodeData, d => d.id);

  circles.exit().remove();

  circles.enter()
    .append('circle')
    .attr('class', 'minimap-node')
    .attr('r', 1.5)
    .attr('opacity', 0.7)
    .merge(circles)
    .attr('cx', d => padding + (d.x - xMin) * scale)
    .attr('cy', d => padding + (d.y - yMin) * scale)
    .attr('fill', d => {
      const p = d.parent || 'Root';
      return parentColors.value[p] || '#818cf8';
    });
}

function updateMinimapViewport() {
  if (!minimapG || !minimapBounds.scale || !svg) return;
  const { xMin, yMin, scale, cw, ch, padding, mw, mh } = minimapBounds;

  // Get current zoom transform
  const currentTransform = d3.zoomTransform(svg.node());
  const k = currentTransform.k;
  const tx = currentTransform.x;
  const ty = currentTransform.y;

  // Visible area in graph coordinates
  const visibleX = -tx / k;
  const visibleY = -ty / k;
  const visibleW = cw / k;
  const visibleH = ch / k;

  // Map to minimap coordinates
  const vx = padding + (visibleX - xMin) * scale;
  const vy = padding + (visibleY - yMin) * scale;
  const vw = visibleW * scale;
  const vh = visibleH * scale;

  minimapG.select('.minimap-viewport')
    .attr('x', Math.max(0, vx))
    .attr('y', Math.max(0, vy))
    .attr('width', Math.min(mw, vw))
    .attr('height', Math.min(mh, vh));
}
</script>

<template>
  <div class="graph-layout">
    <div class="graph-toolbar glass">
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

      <div class="toolbar-actions">
        <!-- Focus Mode toggle -->
        <button
          :class="['tool-btn', { active: focusMode }]"
          @click="toggleFocusMode"
          title="Focus Mode: dim unrelated nodes on hover"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
          </svg>
          <span>Focus</span>
        </button>

        <!-- Layout toggle -->
        <button
          :class="['tool-btn', { active: layoutMode === 'tree' }]"
          @click="toggleLayout"
          :title="layoutMode === 'force' ? 'Switch to Tree layout' : 'Switch to Force layout'"
        >
          <svg v-if="layoutMode === 'force'" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/>
            <path d="M7 7l4 9M17 7l-4 9M7 6h10"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v8M8 10l4-8 4 8M6 18h12M12 10v8"/>
          </svg>
          <span>{{ layoutMode === 'force' ? 'Force' : 'Tree' }}</span>
        </button>

        <!-- Cmd+K hint -->
        <button class="tool-btn cmd-hint" @click="cmdPaletteOpen = true; nextTick(() => cmdInput?.focus())">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <kbd>⌘K</kbd>
        </button>
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

      <!-- Hover tooltip -->
      <div v-if="tooltip" class="graph-tooltip glass" :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }">
        <div class="tooltip-title">{{ tooltip.title }}</div>
        <code class="tooltip-key">{{ tooltip.key }}</code>
        <div v-if="tooltipLoading" class="tooltip-loading">
          <div class="tooltip-spinner" />
          <span>Loading preview...</span>
        </div>
        <p v-else class="tooltip-snippet">{{ tooltipSnippet || 'No content available' }}</p>
      </div>

      <!-- Legend -->
      <div v-if="Object.keys(parentColors).length" class="graph-legend glass">
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

      <!-- Mini-map -->
      <div id="minimap-container" class="minimap glass" />

      <!-- Detail panel -->
      <transition name="slide-panel">
        <div v-if="selectedNode" class="detail-panel glass">
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
            <span v-if="selectedNode.centrality" class="meta-centrality">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
              {{ selectedNode.centrality }} connections
            </span>
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

    <!-- Command Palette Overlay -->
    <transition name="fade">
      <div v-if="cmdPaletteOpen" class="cmd-palette-overlay" @click.self="cmdPaletteOpen = false">
        <div class="cmd-palette glass">
          <div class="cmd-input-area">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              ref="cmdInput"
              v-model="cmdQuery"
              @input="searchCommandPalette"
              type="text"
              placeholder="Search sections by title or tag..."
              class="cmd-input"
            />
            <kbd class="cmd-esc-hint">ESC</kbd>
          </div>
          <div class="cmd-results">
            <div v-if="cmdLoading" class="cmd-loading">
              <div class="cmd-spinner" />
              <span>Searching...</span>
            </div>
            <div v-else-if="cmdQuery && !cmdResults.length" class="cmd-no-results">
              No results for "{{ cmdQuery }}"
            </div>
            <div v-else-if="!cmdQuery" class="cmd-hint-text">
              Start typing to search wiki sections
            </div>
            <template v-else>
              <div
                v-for="(result, idx) in cmdResults"
                :key="result.key"
                :class="['cmd-result-item', { 'cmd-result-active': idx === cmdSelectedIdx }]"
                @click="navigateToSection(result.key); cmdPaletteOpen = false"
                @mouseenter="cmdSelectedIdx = idx"
              >
                <div class="cmd-result-title">{{ result.title }}</div>
                <div class="cmd-result-meta">
                  <span class="cmd-result-key">{{ result.key }}</span>
                  <span class="cmd-result-parent">{{ result.parent }}</span>
                </div>
                <p v-if="result.snippet" class="cmd-result-snippet">{{ result.snippet }}</p>
              </div>
            </template>
          </div>
          <div class="cmd-footer">
            <span><kbd>↑↓</kbd> navigate</span>
            <span><kbd>↵</kbd> open</span>
            <span><kbd>ESC</kbd> close</span>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.graph-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Toolbar with glassmorphism */
.graph-toolbar {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  gap: 10px;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-elevated);
  flex-wrap: wrap;
}

@media (prefers-color-scheme: dark) {
  .graph-toolbar {
    background: var(--glass-bg);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border-bottom: 1px solid var(--glass-border);
  }
}

.search-wrapper {
  flex: 1;
  min-width: 180px;
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

.toolbar-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.tool-btn {
  display: flex;
  align-items: center;
  gap: 5px;
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

.tool-btn:hover {
  border-color: var(--accent-border);
  color: var(--accent);
  background: var(--accent-bg);
}

.tool-btn.active {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-bg);
  box-shadow: 0 0 0 2px var(--accent-bg);
}

.cmd-hint kbd {
  font-family: var(--mono);
  font-size: 10px;
  padding: 1px 5px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-elevated);
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
  align-items: center;
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
  background: transparent;
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

/* Tooltip with glassmorphism */
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

@media (prefers-color-scheme: dark) {
  .graph-tooltip {
    background: var(--glass-bg);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: 1px solid var(--glass-border);
  }
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

/* Legend with glassmorphism */
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

@media (prefers-color-scheme: dark) {
  .graph-legend {
    background: var(--glass-bg);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: 1px solid var(--glass-border);
  }
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

/* Mini-map */
.minimap {
  position: absolute;
  bottom: 16px;
  right: 16px;
  z-index: 50;
  width: 180px;
  height: 120px;
  border-radius: var(--radius-md);
  overflow: hidden;
  cursor: pointer;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
}

@media (prefers-color-scheme: dark) {
  .minimap {
    background: var(--glass-bg);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: 1px solid var(--glass-border);
  }
}

/* Detail panel with glassmorphism */
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

@media (prefers-color-scheme: dark) {
  .detail-panel {
    background: var(--glass-bg);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border-left: 1px solid var(--glass-border);
  }
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

.meta-centrality {
  font-size: 12px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 4px;
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

/* Command Palette */
.cmd-palette-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 15vh;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.cmd-palette {
  width: 560px;
  max-height: 60vh;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
}

@media (prefers-color-scheme: dark) {
  .cmd-palette {
    background: rgba(24, 24, 27, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border);
  }
}

.cmd-input-area {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-light);
}

.cmd-input-area svg {
  color: var(--text-muted);
  flex-shrink: 0;
}

.cmd-input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--text-h);
  font-size: 16px;
  font-weight: 500;
  outline: none;
}

.cmd-input::placeholder {
  color: var(--text-muted);
}

.cmd-esc-hint {
  font-family: var(--mono);
  font-size: 10px;
  padding: 2px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-muted);
  background: var(--bg);
}

.cmd-results {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  max-height: 40vh;
}

.cmd-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  color: var(--text-muted);
  font-size: 13px;
}

.cmd-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.cmd-no-results, .cmd-hint-text {
  text-align: center;
  padding: 24px;
  color: var(--text-muted);
  font-size: 13px;
}

.cmd-result-item {
  padding: 10px 14px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition);
  border: 1px solid transparent;
}

.cmd-result-item:hover,
.cmd-result-active {
  background: var(--accent-bg);
  border-color: var(--accent-border);
}

.cmd-result-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-h);
  margin-bottom: 4px;
}

.cmd-result-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.cmd-result-key {
  font-family: var(--mono);
  color: var(--accent);
  background: var(--accent-bg);
  padding: 1px 6px;
  border-radius: 4px;
}

.cmd-result-snippet {
  font-size: 12px;
  color: var(--text);
  margin: 0;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cmd-footer {
  display: flex;
  gap: 16px;
  padding: 10px 20px;
  border-top: 1px solid var(--border-light);
  font-size: 11px;
  color: var(--text-muted);
}

.cmd-footer kbd {
  font-family: var(--mono);
  font-size: 10px;
  padding: 1px 5px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg);
  margin-right: 4px;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
