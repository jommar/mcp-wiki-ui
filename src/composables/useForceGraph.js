import * as d3 from 'd3';

const COLOR_OUTGOING = '#fbbf24';
const COLOR_INCOMING = '#cbd5e1';

const PALETTE = [
  '#ff6b6b',
  '#ffd93d',
  '#6bcb77',
  '#4d96ff',
  '#ff8ff8',
  '#00d2d3',
  '#ff9f43',
  '#a29bfe',
  '#fd79a8',
  '#fab1a0',
  '#81ecec',
  '#dfe6e9',
  '#fdcb6e',
  '#e17055',
  '#74b9ff',
  '#d63031',
  '#00b894',
  '#e84393',
  '#0984e3',
  '#b2bec3',
];

export function useForceGraph(containerRef, nodesData, edgesData, _options = {}) {
  const selectedNode = ref(null);
  const filterText = ref('');
  const focusMode = ref(false);
  const layoutMode = ref('force');
  const zoomLevel = ref(1);
  const parentColors = ref({});
  const selectedParents = ref(new Set());
  const tooltip = ref(null);
  const navigateTo = ref(null);
  const minimapNodes = ref([]);
  const minimapBounds = ref(null);
  const healthIssues = ref({ empty: new Set(), orphaned: new Set() });

  let d3ctx = null;

  function buildColorScale(nodes) {
    const parents = [...new Set(nodes.map((n) => n.parent || 'Root'))].sort();
    const scale = {};
    parents.forEach((p, i) => {
      scale[p] = PALETTE[i % PALETTE.length];
    });
    parentColors.value = scale;
    return d3
      .scaleOrdinal()
      .domain(parents)
      .range(parents.map((p) => scale[p]));
  }

  function computeCentrality(nodes, links) {
    const counts = new Map(nodes.map((n) => [n.id, 0]));
    links.forEach((l) => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      counts.set(s, (counts.get(s) || 0) + 1);
      counts.set(t, (counts.get(t) || 0) + 1);
    });
    return counts;
  }

  function init() {
    const container = containerRef.value;
    if (!container || !nodesData.value?.length) return;
    if (d3ctx) destroy();

    const w = container.clientWidth;
    const h = container.clientHeight;

    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', w)
      .attr('height', h)
      .style('background', 'transparent');

    const defs = svg.append('defs');

    // Glow filters
    const glow = defs.append('filter').attr('id', 'glow');
    glow.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
    const feMerge = glow.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const strongGlow = defs.append('filter').attr('id', 'strong-glow');
    strongGlow.append('feGaussianBlur').attr('stdDeviation', '6').attr('result', 'coloredBlur');
    const feMerge2 = strongGlow.append('feMerge');
    feMerge2.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge2.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge2.append('feMergeNode').attr('in', 'SourceGraphic');

    const rawNodes = (nodesData.value || []).filter((n) => (n.contentLength || 0) > 0);
    const rawEdges = (edgesData.value || []).filter(
      (e) => rawNodes.some((n) => n.id === e.source) && rawNodes.some((n) => n.id === e.target),
    );

    const colorScale = buildColorScale(rawNodes);
    const parents = [...new Set(rawNodes.map((n) => n.parent || 'Root'))];

    // Radial gradients per parent
    parents.forEach((p) => {
      const color = colorScale(p);
      const grad = defs
        .append('radialGradient')
        .attr('id', `rg-${p.replace(/[^a-zA-Z0-9]/g, '_')}`)
        .attr('cx', '35%')
        .attr('cy', '35%')
        .attr('r', '65%');
      grad
        .append('stop')
        .attr('offset', '0%')
        .attr('stop-color', d3.color(color)?.brighter(0.8) || color);
      grad.append('stop').attr('offset', '60%').attr('stop-color', color);
      grad
        .append('stop')
        .attr('offset', '100%')
        .attr('stop-color', d3.color(color)?.darker(0.5) || color);
    });

    const zoom = d3
      .zoom()
      .scaleExtent([0.05, 5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        zoomLevel.value = event.transform.k;
        updateMinimapViewport(event.transform, w, h);
      });
    svg.call(zoom);

    const g = svg.append('g');

    const nodeMap = new Map(rawNodes.map((n) => [n.id, { ...n }]));
    const linkData = rawEdges.map((e) => ({ source: e.source, target: e.target }));
    const nodeData = rawNodes.map((n) => nodeMap.get(n.id));

    const centrality = computeCentrality(nodeData, linkData);
    const maxCentrality = Math.max(...Array.from(centrality.values()), 1);
    nodeData.forEach((n) => {
      n.centrality = centrality.get(n.id) || 0;
      n.radius = 5 + (n.centrality / maxCentrality) * 14;
    });

    const adjacency = new Map(nodeData.map((n) => [n.id, new Set()]));
    linkData.forEach((l) => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      adjacency.get(s)?.add(t);
      adjacency.get(t)?.add(s);
    });

    // Cluster centers
    const byParent = {};
    nodeData.forEach((n) => {
      const p = n.parent || 'Root';
      if (!byParent[p]) byParent[p] = [];
      byParent[p].push(n);
    });
    const parentKeys = Object.keys(byParent);
    const clusterR = Math.min(w, h) * 0.32;
    const clusterCenters = {};
    parentKeys.forEach((p, i) => {
      const angle = (2 * Math.PI * i) / parentKeys.length - Math.PI / 2;
      clusterCenters[p] = {
        x: w / 2 + clusterR * Math.cos(angle),
        y: h / 2 + clusterR * Math.sin(angle),
      };
    });

    // Animated background circles
    const bg = g.insert('g', ':first-child');
    const maxR = Math.max(w, h) * 0.6;
    function addCircles(count, maxRad, opts) {
      const grp = bg.append('g');
      for (let i = 1; i <= count; i++) {
        grp
          .append('circle')
          .attr('cx', w / 2)
          .attr('cy', h / 2)
          .attr('r', (maxRad / count) * i)
          .attr('fill', 'none')
          .attr('stroke', opts.base)
          .attr('stroke-opacity', opts.baseOp)
          .attr('stroke-width', opts.baseW)
          .attr('class', opts.cls);
      }
      function animate() {
        let done = 0;
        grp
          .selectAll('.' + opts.cls)
          .transition()
          .duration(opts.dur)
          .ease(d3.easeSinInOut)
          .attr('stroke-opacity', opts.pulseOp)
          .attr('stroke', opts.pulse)
          .attr('stroke-width', opts.pulseW)
          .attr('r', (d, i) => (maxRad / count) * (i + 1) * 1.03)
          .transition()
          .duration(opts.dur)
          .ease(d3.easeSinInOut)
          .attr('stroke-opacity', opts.baseOp)
          .attr('stroke', opts.base)
          .attr('stroke-width', opts.baseW)
          .attr('r', (d, i) => (maxRad / count) * (i + 1))
          .on('end', () => {
            if (++done >= count) setTimeout(animate, opts.delay);
          });
      }
      animate();
    }
    addCircles(8, maxR, {
      base: '#60a5fa',
      pulse: '#f87171',
      baseOp: 0.08,
      pulseOp: 0.18,
      baseW: 1,
      pulseW: 2,
      dur: 5000,
      delay: 800,
      cls: 'bg-c1',
    });
    addCircles(16, maxR * 1.2, {
      base: '#2dd4bf',
      pulse: '#5eead4',
      baseOp: 0.04,
      pulseOp: 0.08,
      baseW: 0.5,
      pulseW: 1,
      dur: 7000,
      delay: 400,
      cls: 'bg-c2',
    });

    // Links
    const linkGroup = g
      .append('g')
      .selectAll('path')
      .data(linkData)
      .join('path')
      .attr('class', 'graph-link')
      .attr('fill', 'none')
      .attr('stroke', '#27272a')
      .attr('stroke-opacity', 0.3)
      .attr('stroke-width', 1.2);

    // Nodes
    const nodeGroup = g
      .append('g')
      .selectAll('g')
      .data(nodeData)
      .join('g')
      .attr('class', 'graph-node')
      .attr('cursor', 'pointer')
      .call(
        d3
          .drag()
          .on('start', (e, d) => {
            if (!e.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (e, d) => {
            d.fx = e.x;
            d.fy = e.y;
          })
          .on('end', (e, d) => {
            if (!e.active) simulation.alphaTarget(0);
            if (layoutMode.value === 'force') {
              d.fx = null;
              d.fy = null;
            }
          }),
      );

    nodeGroup
      .append('circle')
      .attr('class', 'node-glow')
      .attr('r', (d) => d.radius + 5)
      .attr('fill', 'none')
      .attr('stroke', (d) => colorScale(d.parent || 'Root'))
      .attr('stroke-opacity', (d) => 0.05 + (d.centrality / maxCentrality) * 0.2)
      .attr('stroke-width', (d) => 1 + (d.centrality / maxCentrality) * 3);

    nodeGroup
      .append('circle')
      .attr('class', 'node-main')
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => `url(#rg-${(d.parent || 'Root').replace(/[^a-zA-Z0-9]/g, '_')})`)
      .attr('stroke', '#09090b')
      .attr('stroke-width', 1.5)
      .attr('filter', (d) =>
        d.centrality > maxCentrality * 0.5 ? 'url(#strong-glow)' : 'url(#glow)',
      );

    nodeGroup
      .filter((d) => healthIssues.value.empty.has(d.id) || healthIssues.value.orphaned.has(d.id))
      .append('circle')
      .attr('class', 'health-ring')
      .attr('r', (d) => d.radius + 3)
      .attr('fill', 'none')
      .attr('stroke', (d) => (healthIssues.value.empty.has(d.id) ? '#ef4444' : '#f59e0b'))
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '3,3')
      .attr('stroke-opacity', 0.8);

    nodeGroup
      .append('text')
      .attr('class', 'node-label')
      .attr('dy', (d) => d.radius + 14)
      .attr('text-anchor', 'middle')
      .attr('fill', '#a1a1aa')
      .attr('font-size', '9px')
      .attr('font-weight', '500')
      .attr('pointer-events', 'none')
      .text((d) => (d.title.length > 22 ? d.title.slice(0, 20) + '…' : d.title));

    nodeGroup.on('mouseover', (event, d) => {
      event.stopPropagation();
      const nodeId = selectedNode.value?.id || d.id;
      highlight(
        nodeId === d.id ? d.id : selectedNode.value?.id || d.id,
        adjacency,
        linkData,
        maxCentrality,
      );
      const inc = linkData.filter(
        (l) => (typeof l.target === 'object' ? l.target.id : l.target) === d.id,
      ).length;
      const out = linkData.filter(
        (l) => (typeof l.source === 'object' ? l.source.id : l.source) === d.id,
      ).length;
      tooltip.value = { d, event, incoming: inc, outgoing: out };
    });
    nodeGroup.on('mousemove', (event) => {
      if (tooltip.value) tooltip.value = { ...tooltip.value, event };
    });
    nodeGroup.on('mouseout', () => {
      if (selectedNode.value) highlight(selectedNode.value.id, adjacency, linkData, maxCentrality);
      else resetHighlight(linkData, maxCentrality);
      tooltip.value = null;
    });
    nodeGroup.on('click', (event, d) => {
      event.stopPropagation();
      tooltip.value = null;
      selectedNode.value = d;
      highlight(d.id, adjacency, linkData, maxCentrality);
    });
    nodeGroup.on('dblclick', (event, d) => {
      event.stopPropagation();
      navigateTo.value = d.id;
    });

    svg.on('click', () => {
      selectedNode.value = null;
      resetHighlight(linkData, maxCentrality);
    });

    const simulation = d3
      .forceSimulation(nodeData)
      .force(
        'link',
        d3
          .forceLink(linkData)
          .id((d) => d.id)
          .distance(100)
          .strength(0.3),
      )
      .force('charge', d3.forceManyBody().strength(-250))
      .force('center', d3.forceCenter(w / 2, h / 2).strength(0.03))
      .force(
        'collision',
        d3.forceCollide().radius((d) => d.radius + 8),
      )
      .force('x', d3.forceX((d) => clusterCenters[d.parent || 'Root']?.x ?? w / 2).strength(0.12))
      .force('y', d3.forceY((d) => clusterCenters[d.parent || 'Root']?.y ?? h / 2).strength(0.12));

    simulation.on('tick', () => {
      linkGroup.attr('d', (d) => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dr = Math.sqrt(dx * dx + dy * dy) * 1.2;
        return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
      });
      nodeGroup.attr('transform', (d) => `translate(${d.x},${d.y})`);
      minimapNodes.value = nodeData.map((n) => ({ id: n.id, x: n.x, y: n.y, parent: n.parent }));
      computeMinimapBounds(nodeData, w, h);
    });

    d3ctx = {
      svg,
      g,
      zoom,
      simulation,
      linkGroup,
      nodeGroup,
      nodeData,
      linkData,
      adjacency,
      maxCentrality,
      colorScale,
      w,
      h,
      clusterCenters,
    };
  }

  function highlight(nodeId, adjacency, _linkData, _maxCentrality) {
    const neighbors = new Set(adjacency.get(nodeId) || []);
    neighbors.add(nodeId);

    d3.selectAll('.graph-node')
      .transition()
      .duration(200)
      .attr('opacity', (d) => {
        const p = d.parent || 'Root';
        const tf = filterText.value.toLowerCase();
        if (selectedParents.value.size > 0 && !selectedParents.value.has(p)) return 0.06;
        if (
          tf &&
          !(d.title || '').toLowerCase().includes(tf) &&
          !(d.id || '').toLowerCase().includes(tf)
        )
          return 0.1;
        return neighbors.has(d.id) ? 1 : focusMode.value ? 0.05 : 0.2;
      });

    d3.selectAll('.graph-link')
      .transition()
      .duration(200)
      .attr('stroke-opacity', (d) => {
        const s = typeof d.source === 'object' ? d.source.id : d.source;
        const t = typeof d.target === 'object' ? d.target.id : d.target;
        return s === nodeId || t === nodeId ? 0.9 : 0.04;
      })
      .attr('stroke', (d) => {
        const s = typeof d.source === 'object' ? d.source.id : d.source;
        const t = typeof d.target === 'object' ? d.target.id : d.target;
        if (s === nodeId) return COLOR_OUTGOING;
        if (t === nodeId) return COLOR_INCOMING;
        return '#27272a';
      })
      .attr('stroke-width', (d) => {
        const s = typeof d.source === 'object' ? d.source.id : d.source;
        const t = typeof d.target === 'object' ? d.target.id : d.target;
        return s === nodeId || t === nodeId ? 2.5 : 1;
      });

    d3.selectAll('.graph-node')
      .filter((d) => d.id === nodeId)
      .select('.node-main')
      .attr('filter', 'url(#strong-glow)');
  }

  function resetHighlight(_linkData, _maxCentrality) {
    const tf = filterText.value.toLowerCase();
    d3.selectAll('.graph-link')
      .transition()
      .duration(300)
      .attr('stroke-opacity', 0.3)
      .attr('stroke', '#27272a')
      .attr('stroke-width', 1.2);
    d3.selectAll('.graph-node')
      .transition()
      .duration(300)
      .attr('opacity', (d) => {
        const p = d.parent || 'Root';
        if (selectedParents.value.size > 0 && !selectedParents.value.has(p)) return 0.08;
        if (!tf) return 1;
        return (d.title || '').toLowerCase().includes(tf) || (d.id || '').toLowerCase().includes(tf)
          ? 1
          : 0.15;
      });
    if (d3ctx) {
      d3.selectAll('.graph-node')
        .select('.node-main')
        .attr('filter', (d) =>
          d.centrality > d3ctx.maxCentrality * 0.5 ? 'url(#strong-glow)' : 'url(#glow)',
        );
    }
  }

  function applyFilters() {
    if (!d3ctx) return;
    resetHighlight(d3ctx.linkData, d3ctx.maxCentrality);
    if (selectedNode.value)
      highlight(selectedNode.value.id, d3ctx.adjacency, d3ctx.linkData, d3ctx.maxCentrality);
  }

  function computeMinimapBounds(nodeData, w, h) {
    const xs = nodeData.map((n) => n.x).filter(Boolean);
    const ys = nodeData.map((n) => n.y).filter(Boolean);
    if (!xs.length) return;
    minimapBounds.value = {
      xMin: Math.min(...xs),
      xMax: Math.max(...xs),
      yMin: Math.min(...ys),
      yMax: Math.max(...ys),
      w,
      h,
    };
  }

  function updateMinimapViewport(transform, _w, _h) {
    if (!minimapBounds.value) return;
    minimapBounds.value = { ...minimapBounds.value, transform };
  }

  function destroy() {
    if (d3ctx?.simulation) d3ctx.simulation.stop();
    if (containerRef.value) containerRef.value.innerHTML = '';
    d3ctx = null;
  }

  function zoomIn() {
    d3ctx?.svg.transition().call(d3ctx.zoom.scaleBy, 1.3);
  }
  function zoomOut() {
    d3ctx?.svg.transition().call(d3ctx.zoom.scaleBy, 0.77);
  }
  function resetZoom() {
    d3ctx?.svg.transition().call(d3ctx.zoom.transform, d3.zoomIdentity);
  }
  function toggleFocusMode() {
    focusMode.value = !focusMode.value;
    applyFilters();
  }

  function toggleLayout() {
    if (!d3ctx) return;
    layoutMode.value = layoutMode.value === 'force' ? 'tree' : 'force';
    const { nodeData, linkData, simulation, w, h, clusterCenters } = d3ctx;

    if (layoutMode.value === 'tree') {
      const byParent = {};
      nodeData.forEach((n) => {
        const p = n.parent || 'Root';
        (byParent[p] = byParent[p] || []).push(n);
      });
      Object.keys(byParent).forEach((p, i) => {
        const angle = (2 * Math.PI * i) / Object.keys(byParent).length - Math.PI / 2;
        const px = w / 2 + 200 * Math.cos(angle);
        const py = h / 2 + 200 * Math.sin(angle);
        byParent[p].forEach((child, j) => {
          const ca = angle + (j - byParent[p].length / 2) * 0.4;
          child.fx = px + 130 * Math.cos(ca);
          child.fy = py + 130 * Math.sin(ca);
        });
      });
      simulation
        .force(
          'link',
          d3
            .forceLink(linkData)
            .id((d) => d.id)
            .distance(60)
            .strength(0.8),
        )
        .force('charge', d3.forceManyBody().strength(-80))
        .force('center', null)
        .force('x', null)
        .force('y', null)
        .alpha(0.5)
        .restart();
      setTimeout(() => {
        nodeData.forEach((n) => {
          n.fx = n.x;
          n.fy = n.y;
        });
        simulation.alpha(0).stop();
      }, 1500);
    } else {
      nodeData.forEach((n) => {
        n.fx = null;
        n.fy = null;
      });
      simulation
        .force(
          'link',
          d3
            .forceLink(linkData)
            .id((d) => d.id)
            .distance(100)
            .strength(0.3),
        )
        .force('charge', d3.forceManyBody().strength(-250))
        .force('center', d3.forceCenter(w / 2, h / 2).strength(0.03))
        .force('x', d3.forceX((d) => clusterCenters[d.parent || 'Root']?.x ?? w / 2).strength(0.12))
        .force('y', d3.forceY((d) => clusterCenters[d.parent || 'Root']?.y ?? h / 2).strength(0.12))
        .alpha(0.8)
        .restart();
    }
  }

  function panToNode(id) {
    if (!d3ctx) return;
    const node = d3ctx.nodeData.find((n) => n.id === id);
    if (!node) return;
    d3ctx.svg.transition().call(d3ctx.zoom.translateTo, node.x, node.y);
  }

  function panTo(x, y) {
    if (!d3ctx) return;
    d3ctx.svg.call(d3ctx.zoom.translateTo, x, y);
  }

  function setHealthIssues(issues) {
    healthIssues.value = issues;
  }

  watch(filterText, applyFilters);
  watch(selectedParents, applyFilters, { deep: true });

  watch(containerRef, (el) => {
    if (el) init();
    else destroy();
  });

  watch([nodesData, edgesData], () => {
    if (containerRef.value) init();
  });

  onUnmounted(destroy);

  return {
    selectedNode,
    filterText,
    focusMode,
    layoutMode,
    zoomLevel,
    parentColors,
    selectedParents,
    tooltip,
    navigateTo,
    minimapNodes,
    minimapBounds,
    zoomIn,
    zoomOut,
    resetZoom,
    toggleFocusMode,
    toggleLayout,
    clearParentFilter: () => {
      selectedParents.value = new Set();
      applyFilters();
    },
    panToNode,
    panTo,
    setHealthIssues,
  };
}
