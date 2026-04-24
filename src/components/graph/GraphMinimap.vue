<script setup>
import { ref, watch, onMounted } from 'vue';
import * as d3 from 'd3';

const props = defineProps({
  nodes: { type: Array, default: () => [] },
  bounds: { type: Object, default: null },
  colors: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['pan-to']);

const containerEl = ref(null);
const MW = 180, MH = 120;
const pad = 8;
let minimapSvg, minimapG;
let mmXMin = 0, mmYMin = 0, mmScale = 1;

onMounted(() => { initMinimap(); });

function initMinimap() {
  if (!containerEl.value) return;
  containerEl.value.innerHTML = '';
  minimapSvg = d3.select(containerEl.value).append('svg')
    .attr('width', MW).attr('height', MH)
    .style('background', 'transparent').style('cursor', 'crosshair');
  minimapG = minimapSvg.append('g');
  minimapG.append('rect').attr('class', 'mm-vp')
    .attr('fill', 'rgba(129,140,248,0.1)').attr('stroke', '#818cf8')
    .attr('stroke-width', 1.5).attr('rx', 2).attr('x', 0).attr('y', 0)
    .attr('width', MW).attr('height', MH);

  minimapSvg.call(
    d3.drag()
      .on('start drag', (event) => {
        emit('pan-to', {
          x: (event.x - pad) / mmScale + mmXMin,
          y: (event.y - pad) / mmScale + mmYMin,
        });
      }),
  );
}

watch(() => props.nodes, () => updateNodes(), { deep: true });
watch(() => props.bounds, () => updateViewport(), { deep: true });

function computeScale(xs, ys) {
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const sx = (MW - pad * 2) / (xMax - xMin || 1);
  const sy = (MH - pad * 2) / (yMax - yMin || 1);
  return { xMin, yMin, scale: Math.min(sx, sy) };
}

function updateNodes() {
  if (!minimapG || !props.nodes.length) return;
  const xs = props.nodes.map((n) => n.x).filter((v) => v != null);
  const ys = props.nodes.map((n) => n.y).filter((v) => v != null);
  if (!xs.length) return;

  const { xMin, yMin, scale } = computeScale(xs, ys);
  mmXMin = xMin; mmYMin = yMin; mmScale = scale;

  const circles = minimapG.selectAll('.mm-node').data(props.nodes, (d) => d.id);
  circles.exit().remove();
  circles.enter().append('circle').attr('class', 'mm-node').attr('r', 1.5).attr('opacity', 0.8)
    .merge(circles)
    .attr('cx', (d) => pad + (d.x - xMin) * scale)
    .attr('cy', (d) => pad + (d.y - yMin) * scale)
    .attr('fill', (d) => props.colors[d.parent || 'Root'] || '#818cf8');
}

function updateViewport() {
  if (!minimapG || !props.bounds || !props.nodes.length) return;
  const { transform, w, h } = props.bounds;
  if (!transform) return;
  const xs = props.nodes.map((n) => n.x).filter((v) => v != null);
  const ys = props.nodes.map((n) => n.y).filter((v) => v != null);
  if (!xs.length) return;

  const { xMin, yMin, scale } = computeScale(xs, ys);
  const k = transform.k, tx = transform.x, ty = transform.y;
  const vx = pad + (-tx / k - xMin) * scale;
  const vy = pad + (-ty / k - yMin) * scale;
  const vw = (w / k) * scale, vh = (h / k) * scale;

  minimapG.select('.mm-vp').attr('x', Math.max(0, vx)).attr('y', Math.max(0, vy))
    .attr('width', Math.min(MW, vw)).attr('height', Math.min(MH, vh));
}
</script>

<template>
  <div class="absolute bottom-4 right-4 z-20 rounded-xl border border-border overflow-hidden"
       style="background: var(--glass-bg); backdrop-filter: var(--glass-blur);">
    <div ref="containerEl" class="w-[180px] h-[120px]" />
  </div>
</template>
