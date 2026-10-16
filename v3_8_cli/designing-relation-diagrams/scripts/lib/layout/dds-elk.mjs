// Isolated ELK adapter for the D1 comparison. It never mutates the source IR.
import ELK from '../../vendor/elkjs/elk.bundled.js';

const elk = new ELK();
function size(n) {
  const height = n.h || 44;
  let width = n.w || 176;
  const textWidth = Array.from(String(n.label || '')).reduce((sum, ch) => sum + (/^[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af\u4e00-\u9fff]$/.test(ch) ? 14.5 : 8.6), 0);
  const needed = textWidth + 36 + (n.collapsed ? 26 : 0) + (n.role === 'entity' ? height / 2 : 0);
  if ((n.collapsed || !n.w) && needed > width) width = needed;
  return { width, height };
}

export async function layoutState(DDS, ir, state) {
  const started = performance.now();
  const view = DDS.view(ir, state.options?.level ?? 1, {
    expand: state.options?.expand || [], collapse: state.options?.collapse || [],
  });
  const children = view.nodes.map(n => ({ id: n.id, ...size(n) }));
  const ids = new Set(children.map(n => n.id));
  const edgeSourceByElkId = new Map();
  const edges = view.edges.filter(e => ids.has(e.from) && ids.has(e.to)).map((e, i) => {
    const id = `${e.id || 'edge'}:${i}`;
    edgeSourceByElkId.set(id, e);
    return { id, sources: [e.from], targets: [e.to] };
  });
  const result = await elk.layout({
    id: `state:${state.id}`, children, edges,
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.spacing.nodeNode': '36',
      'elk.layered.spacing.nodeNodeBetweenLayers': '72',
      'elk.padding': '[top=24,left=24,bottom=24,right=24]',
    },
  });
  const positions = Object.fromEntries((result.children || []).map(n => [n.id, [n.x + n.width / 2, n.y + n.height / 2]]));
  const boxes = Object.fromEntries((result.children || []).map(n => [n.id, { x:n.x, y:n.y, w:n.width, h:n.height }]));
  if ((result.edges || []).length !== edges.length) throw new Error(`ELK edge count mismatch in state ${state.id}: ${result.edges?.length || 0} != ${edges.length}`);
  const routes = [];
  (result.edges || []).forEach((edge, i) => {
    const source = edgeSourceByElkId.get(edge.id);
    (edge.sections || []).forEach(section => {
      const points = [section.startPoint, ...(section.bendPoints || []), section.endPoint].filter(Boolean).map(p => [p.x, p.y]);
      routes.push({ id: source?.id || edge.id, from: source?.from, to: source?.to, points,
        provenance: source?.sourceEdgeIds || [source?.id].filter(Boolean),
        label: source?.label || '', labels: edge.labels || [] });
    });
  });
  const routeMap = Object.create(null);
  for (const r of routes) {
    if (!routeMap[r.id]) routeMap[r.id] = { ...r, points:r.points.slice() };
    else if (routeMap[r.id].points.at(-1)?.[0] !== r.points[0]?.[0] || routeMap[r.id].points.at(-1)?.[1] !== r.points[0]?.[1]) routeMap[r.id].points.push(...r.points);
  }
  return {
    stateId: state.id, positions, boxes, routes,
    visibleNodeIds: view.nodes.map(n => n.id),
    routes: routeMap,
    routeRecords: routes,
    visibleEdges: view.edges.map(e => ({ id:e.id, from:e.from, to:e.to, sourceEdgeIds:e.sourceEdgeIds || [e.id].filter(Boolean), label:e.label || '' })),
    regions: (view.groups || []).map(g => ({ id:g.id, label:g.label, members:g.members })),
    width:result.width, height:result.height,
    layoutMs: performance.now() - started,
    provenance: 'ELK layered / orthogonal; flat visible-node projection',
  };
}

export function applyCoordinates(ir, layout, level) {
  const clone = JSON.parse(JSON.stringify(ir));
  for (const n of clone.nodes) {
    const p = layout.positions[n.id];
    if (!p) continue;
    n.pos = { ...(n.pos || {}), [level]: p };
  }
  const right = Object.values(layout.boxes).reduce((m,b) => Math.max(m,b.x+b.w), 780);
  const bottom = Object.values(layout.boxes).reduce((m,b) => Math.max(m,b.y+b.h), 420);
  clone.w = right + 24; clone.h = bottom + 24;
  return clone;
}
