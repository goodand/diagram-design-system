import { AvoidLib } from '../../vendor/libavoid/index-node.mjs';

const SIDES = ['left', 'right', 'top', 'bottom'];
let initialized;

// Validate before entering native WASM: malformed geometry can abort its runtime.
function validateInput(view) {
  const fail = message => { throw new Error(`Invalid routing input: ${message}`); };
  if (!Array.isArray(view?.nodes) || !Array.isArray(view?.edges)) fail('nodes and edges must be arrays');
  const nodes = new Set(), edges = new Set();
  for (const n of view.nodes) {
    if (!n || typeof n.id !== 'string' || !n.id || nodes.has(n.id)) fail('node IDs must be nonempty and unique');
    nodes.add(n.id);
    if (![n.x,n.y,n.w,n.h].every(Number.isFinite) || n.w <= 0 || n.h <= 0) fail(`finite coordinates and positive dimensions required: ${n.id}`);
  }
  for (const e of view.edges) {
    if (!e || typeof e.id !== 'string' || !e.id || edges.has(e.id)) fail('edge IDs must be nonempty and unique');
    edges.add(e.id);
    if (!nodes.has(e.from) || !nodes.has(e.to)) fail(`unknown endpoint: ${e.id}`);
    if ([e.fromSide,e.toSide].some(side=>side!==undefined&&!SIDES.includes(side))) fail(`unknown port side: ${e.id}`);
  }
}

function center(n) { return { x: n.x + n.w / 2, y: n.y + n.h / 2 }; }

function chooseSide(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'bottom' : 'top';
}

function sidePoint(n, side, fraction = 0.5, clearance = 1) {
  const f = Math.max(0.12, Math.min(0.88, fraction));
  if (side === 'left') return { x: n.x - clearance, y: n.y + n.h * f };
  if (side === 'right') return { x: n.x + n.w + clearance, y: n.y + n.h * f };
  if (side === 'top') return { x: n.x + n.w * f, y: n.y - clearance };
  return { x: n.x + n.w * f, y: n.y + n.h + clearance };
}

function assignPorts(view, gap = 18) {
  validateInput(view);
  const byId = new Map(view.nodes.map(n => [n.id, n]));
  const ends = [];
  for (const e of view.edges) {
    const a = byId.get(e.from), b = byId.get(e.to);
    if (!a || !b) throw new Error(`Unknown endpoint on edge ${e.id}`);
    const ac = center(a), bc = center(b);
    ends.push({ edge: e, end: 'from', node: a, side: e.fromSide || (e.from===e.to ? 'right' : chooseSide(ac, bc)), neighbor: bc });
    ends.push({ edge: e, end: 'to', node: b, side: e.toSide || (e.from===e.to ? 'top' : chooseSide(bc, ac)), neighbor: ac });
  }
  const portPoints = new Map(), portInfo = new Map();
  for (const n of view.nodes) for (const side of SIDES) {
    const onSide = ends.filter(x => x.node.id === n.id && x.side === side);
    onSide.sort((a, b) => (side === 'left' || side === 'right')
      ? a.neighbor.y - b.neighbor.y || String(a.edge.id).localeCompare(String(b.edge.id))
      : a.neighbor.x - b.neighbor.x || String(a.edge.id).localeCompare(String(b.edge.id)));
    const length = side === 'left' || side === 'right' ? n.h : n.w;
    onSide.forEach((entry, i) => {
      // Human decision: one midpoint per rectangle side; shared endpoints are allowed.
      const fraction = 0.5;
      const p = sidePoint(n, side, fraction, 1);
      portPoints.set(`${entry.edge.id}:${entry.end}`, p);
      portInfo.set(`${entry.edge.id}:${entry.end}`, { node: n, side, fraction });
    });
  }
  return { byId, portPoints, portInfo, gap };
}

/** Route one already-laid-out visible DDS view. Geometry uses the same coordinate space as SVG. */
export async function routeView(view, options = {}) {
  validateInput(view);
  initialized ||= AvoidLib.load();
  await initialized;
  const A = AvoidLib.getInstance();
  const { byId, portPoints, portInfo } = assignPorts(view);
  const router = new A.Router(A.OrthogonalRouting);
  const shapes = [], shapeById = new Map(), pins = [], connectors = [];
  try {
    router.setRoutingParameter(A.shapeBufferDistance, options.clearance ?? 7);
    router.setRoutingParameter(A.idealNudgingDistance, options.nudgeDistance ?? 18);
    router.setRoutingOption(A.nudgeOrthogonalSegmentsConnectedToShapes, options.nudgeConnectedShapes ?? true);
    router.setRoutingOption(A.nudgeOrthogonalTouchingColinearSegments, true);
    router.setRoutingOption(A.nudgeSharedPathsWithCommonEndPoint, true);
    for (const n of view.nodes) {
      const rect = new A.Rectangle(new A.Point(n.x + n.w / 2, n.y + n.h / 2), n.w, n.h);
      const shape = new A.ShapeRef(router, rect);
      shapes.push(shape); shapeById.set(n.id, shape);
    }
    let classId = 1;
    const sharedPins = new Map();
    for (const edge of view.edges) {
      const source = portInfo.get(`${edge.id}:from`), target = portInfo.get(`${edge.id}:to`);
      const pinEnd = info => {
        const { node, side, fraction } = info;
        const key = `${node.id}:${side}`;
        if (sharedPins.has(key)) return new A.ConnEnd(shapeById.get(node.id), sharedPins.get(key));
        const xOffset = side === 'left' ? 0 : side === 'right' ? 1 : fraction;
        const yOffset = side === 'top' ? 0 : side === 'bottom' ? 1 : fraction;
        const direction = side === 'left' ? A.ConnDirLeft : side === 'right' ? A.ConnDirRight : side === 'top' ? A.ConnDirUp : A.ConnDirDown;
        const pin = new A.ShapeConnectionPin(shapeById.get(node.id), classId, xOffset, yOffset, true, 0, direction);
        pin.setExclusive(false);
        pins.push(pin);
        sharedPins.set(key, classId);
        return new A.ConnEnd(shapeById.get(node.id), classId++);
      };
      const conn = new A.ConnRef(router, pinEnd(source), pinEnd(target));
      conn.setRoutingType(A.ConnType_Orthogonal);
      conn.setHateCrossings(true);
      connectors.push({ id: edge.id, conn });
    }
    router.processTransaction();
    const routes = Object.create(null);
    for (const { id, conn } of connectors) {
      const poly = conn.displayRoute();
      const pts = [];
      for (let i = 0; i < poly.size(); i++) {
        const p = poly.get_ps(i);
        pts.push({ x: p.x, y: p.y });
      }
      routes[id] = pts;
    }
    return routes;
  } finally {
    for (const { conn } of connectors) router.deleteConnector(conn);
    for (const shape of shapes) router.deleteShape(shape);
    A.destroy(router);
  }
}

export { assignPorts };

/** Strict geometric checks for collisions, node-body intrusion, and boundary endpoints. */
export function analyzeRoutes(view, routes, tolerance = 0.01) {
  const { byId, portInfo } = assignPorts(view);
  let nonFiniteRouteCount=0, degenerateRouteCount=0;
  for (const edge of view.edges) {
    const pts=routes&&Object.hasOwn(routes,edge.id)?routes[edge.id]:undefined;
    if (!Array.isArray(pts)||pts.length<2||pts.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))) nonFiniteRouteCount++;
    else if (pts.slice(1).reduce((sum,p,i)=>sum+Math.abs(p.x-pts[i].x)+Math.abs(p.y-pts[i].y),0)<=tolerance) degenerateRouteCount++;
  }
  if(nonFiniteRouteCount||degenerateRouteCount) return {routeCount:view.edges.length,nonFiniteRouteCount,degenerateRouteCount,valid:false};
  const segments = [];
  let diagonalSegmentCount = 0;
  for (const edge of view.edges) {
    const points = routes[edge.id];
    if (!points || points.length < 2) throw new Error(`Missing or empty route: ${edge.id}`);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      if (Math.abs(a.x - b.x) > tolerance && Math.abs(a.y - b.y) > tolerance) diagonalSegmentCount++;
      segments.push({ edgeId: edge.id, edge, a, b });
    }
  }
  const axisOverlap = (a, b) => {
    const ah = Math.abs(a.a.y - a.b.y) <= tolerance && Math.abs(b.a.y - b.b.y) <= tolerance;
    if (ah && Math.abs(a.a.y - b.a.y) <= tolerance) return Math.max(0, Math.min(Math.max(a.a.x,a.b.x),Math.max(b.a.x,b.b.x))-Math.max(Math.min(a.a.x,a.b.x),Math.min(b.a.x,b.b.x)));
    const av = Math.abs(a.a.x - a.b.x) <= tolerance && Math.abs(b.a.x - b.b.x) <= tolerance;
    if (av && Math.abs(a.a.x - b.a.x) <= tolerance) return Math.max(0, Math.min(Math.max(a.a.y,a.b.y),Math.max(b.a.y,b.b.y))-Math.max(Math.min(a.a.y,a.b.y),Math.min(b.a.y,b.b.y)));
    return 0;
  };
  // A trunk must be a contiguous common prefix (split) or suffix (join).
  // Sharing a node alone does not permit later reconvergence or opposite flow.
  function commonPrefix(a, b) {
    const result = [];
    let i = 1, j = 1, p = { ...a[0] }, q = { ...b[0] };
    const close = (u, v) => Math.hypot(u.x-v.x,u.y-v.y) <= tolerance;
    if (!close(p,q)) return result;
    while (i<a.length && j<b.length) {
      const u=a[i], v=b[j], da={x:u.x-p.x,y:u.y-p.y}, db={x:v.x-q.x,y:v.y-q.y};
      const la=Math.abs(da.x)+Math.abs(da.y), lb=Math.abs(db.x)+Math.abs(db.y);
      if (la<=tolerance) { p={...u}; i++; continue; }
      if (lb<=tolerance) { q={...v}; j++; continue; }
      if (!close(p,q) || Math.abs(da.x/la-db.x/lb)>tolerance || Math.abs(da.y/la-db.y/lb)>tolerance) break;
      const length=Math.min(la,lb), next={x:p.x+da.x/la*length,y:p.y+da.y/la*length};
      result.push({a:{...p},b:next}); p={...next}; q={...next};
      if (close(p,u)) i++;
      if (close(q,v)) j++;
    }
    return result;
  }
  const trunkByPair = new Map();
  function sharedTrunks(a,b) {
    const key=JSON.stringify([a.id,b.id]);
    if (trunkByPair.has(key)) return trunkByPair.get(key);
    let trunk=[];
    if (!a.loop && !b.loop && !(a.from===b.from && a.to===b.to)) {
      if (a.from===b.from) trunk.push(...commonPrefix(routes[a.id],routes[b.id]));
      if (a.to===b.to) trunk.push(...commonPrefix([...routes[a.id]].reverse(),[...routes[b.id]].reverse()));
    }
    trunkByPair.set(key,trunk); return trunk;
  }
  let overlapLength = 0, overlappingSegmentPairs = 0, sharedTrunkSegmentPairs = 0, ambiguousOverlapSegmentPairs = 0;
  for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
    if (segments[i].edgeId === segments[j].edgeId) continue;
    const overlap = axisOverlap(segments[i], segments[j]);
    if (overlap > tolerance) {
      overlapLength += overlap; overlappingSegmentPairs++;
      const a=segments[i], b=segments[j];
      const sameDirection=(a.b.x-a.a.x)*(b.b.x-b.a.x)+(a.b.y-a.a.y)*(b.b.y-b.a.y)>0;
      const horizontal=Math.abs(a.a.y-a.b.y)<=tolerance, axis=horizontal?'x':'y';
      const lo=Math.max(Math.min(a.a[axis],a.b[axis]),Math.min(b.a[axis],b.b[axis]));
      const hi=lo+overlap;
      const covered=sharedTrunks(a.edge,b.edge).reduce((sum,t)=>{
        if (axisOverlap(a,t)<=tolerance || axisOverlap(b,t)<=tolerance) return sum;
        return sum+Math.max(0,Math.min(hi,Math.max(t.a[axis],t.b[axis]))-Math.max(lo,Math.min(t.a[axis],t.b[axis])));
      },0);
      if (sameDirection && covered>=overlap-tolerance) sharedTrunkSegmentPairs++;
      else ambiguousOverlapSegmentPairs++;
    }
  }
  let nodeIntrusionLength = 0, nodeIntrusionCount = 0;
  for (const segment of segments) for (const node of view.nodes) {
    const [s, t] = [segment.edge.from, segment.edge.to];
    const x0 = node.x + tolerance, x1 = node.x + node.w - tolerance;
    const y0 = node.y + tolerance, y1 = node.y + node.h - tolerance;
    let intrusion = 0;
    if (Math.abs(segment.a.y - segment.b.y) <= tolerance && segment.a.y > y0 && segment.a.y < y1) {
      intrusion = Math.max(0, Math.min(Math.max(segment.a.x,segment.b.x),x1)-Math.max(Math.min(segment.a.x,segment.b.x),x0));
    } else if (Math.abs(segment.a.x - segment.b.x) <= tolerance && segment.a.x > x0 && segment.a.x < x1) {
      intrusion = Math.max(0, Math.min(Math.max(segment.a.y,segment.b.y),y1)-Math.max(Math.min(segment.a.y,segment.b.y),y0));
    }
    if (intrusion > tolerance) { nodeIntrusionLength += intrusion; nodeIntrusionCount++; }
  }
  let endpointMaxError = 0;
  for (const edge of view.edges) for (const [end, pts] of [['from', routes[edge.id][0]], ['to', routes[edge.id].at(-1)]]) {
    const { node, side } = portInfo.get(`${edge.id}:${end}`);
    let error;
    if (side === 'left') error = Math.abs(pts.x - node.x) + Math.max(0,node.y-pts.y,pts.y-(node.y+node.h));
    else if (side === 'right') error = Math.abs(pts.x - (node.x+node.w)) + Math.max(0,node.y-pts.y,pts.y-(node.y+node.h));
    else if (side === 'top') error = Math.abs(pts.y - node.y) + Math.max(0,node.x-pts.x,pts.x-(node.x+node.w));
    else error = Math.abs(pts.y - (node.y+node.h)) + Math.max(0,node.x-pts.x,pts.x-(node.x+node.w));
    endpointMaxError = Math.max(endpointMaxError, error);
  }
  return {
    routeCount: view.edges.length,
    overlapLength: Number(overlapLength.toFixed(2)), overlappingSegmentPairs,
    sharedTrunkSegmentPairs, ambiguousOverlapSegmentPairs,
    nodeIntrusionLength: Number(nodeIntrusionLength.toFixed(2)), nodeIntrusionCount,
    diagonalSegmentCount, endpointMaxError: Number(endpointMaxError.toFixed(3)),
    valid: ambiguousOverlapSegmentPairs === 0 && nodeIntrusionCount === 0 && diagonalSegmentCount === 0 && endpointMaxError <= tolerance
  };
}
