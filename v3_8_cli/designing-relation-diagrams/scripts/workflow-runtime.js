/* Prebuilt interaction for typed diagrams. No agent-authored HTML or animation. */
(function (global) {
  'use strict';
  function walk(ir, starts, reverse) {
    var found = new Set(starts), pending = starts.slice();
    while (pending.length) { var id = pending.pop(); ir.edges.forEach(function (e) {
      if (e.loop || e.meaning !== 'execution_flow') return;
      var from = reverse ? e.to : e.from, to = reverse ? e.from : e.to;
      if (from === id && !found.has(to)) { found.add(to); pending.push(to); }
    }); }
    return found;
  }
  function scope(ir, kind, id) {
    var ns = new Set(), es = new Set();
    var edgeIds = Array.isArray(id) ? id : [id];
    var represented = new Set([id]);
    if (kind === 'node') ir.nodes.forEach(function (n) { var parent = n.parent; while (parent) { if (parent === id) { represented.add(n.id); break; } var p = ir.nodes.find(function (x) { return x.id === parent; }); parent = p && p.parent; } });
    var candidates = (ir.partials || []).filter(function (p) { return kind === 'node' ? p.nodes.some(function (n) { return represented.has(n); }) : edgeIds.some(function (edge) { return p.edges.includes(edge); }); });
    var hovered = kind === 'node' && ir.nodes.find(function(n){return n.id === id;});
    // A root fold represents the whole parent Core. A detailed target/leaf uses
    // its child memberships, suppressing only their own ancestor (not peers).
    if (!(hovered && hovered.autoFold)) {
      var ancestors = new Set(candidates.map(function(p){return p.parent_partial_id;}).filter(Boolean));
      candidates = candidates.filter(function(p){return !ancestors.has(p.id);});
    }
    candidates.forEach(function (p) {
      p.nodes.forEach(function (x) { ns.add(x); }); p.edges.forEach(function (x) { es.add(x); });
    });
    if (!ns.size) { if (kind === 'node') ns.add(id); else edgeIds.forEach(function (id) { var edge = ir.edges.find(function (e) { return e.id === id; }); if (edge) { ns.add(edge.from); ns.add(edge.to); es.add(id); } }); }
    // Extend only from the selected partial's boundary. Walking from every member
    // (especially a shared initial input) would incorrectly activate sibling parts.
    var selected = ir.edges.filter(function (e) { return es.has(e.id) && !e.loop; });
    var sources = Array.from(ns).filter(function (id) { return !selected.some(function (e) { return e.to === id; }); });
    var sinks = Array.from(ns).filter(function (id) { return !selected.some(function (e) { return e.from === id; }); });
    var up = walk(ir, sources, true), down = walk(ir, sinks, false);
    // Reachability chooses relevant E2E endpoints; it must not promote every
    // intermediate Task from other partials into the active membership.
    ir.e2e.inputs.filter(function (id) { return up.has(id); }).forEach(function (id) { ns.add(id); });
    ir.e2e.outputs.filter(function (id) { return down.has(id); }).forEach(function (id) { ns.add(id); });
    ir.edges.forEach(function (e) { if (!e.loop && ns.has(e.from) && ns.has(e.to)) es.add(e.id); });
    return { nodes:ns, edges:es };
  }
  function flowPlan(ir, input) {
    var reachable = walk(ir, [input], false), toOutput = walk(ir,ir.e2e.outputs,true), degree = {}, queue = [], plan = [];
    ir.nodes.forEach(function (n) { if (reachable.has(n.id) && toOutput.has(n.id)) degree[n.id] = 0; });
    var edges = ir.edges.filter(function (e) { return !e.loop && e.meaning === 'execution_flow' && reachable.has(e.from) && reachable.has(e.to) && toOutput.has(e.to); });
      edges.forEach(function (e) { degree[e.to]++; });
    Object.keys(degree).forEach(function (id) { if (!degree[id]) queue.push(id); });
    while (queue.length) { var id = queue.shift(); edges.filter(function (e) { return e.from === id; }).forEach(function (e) { plan.push({edge:e.id,label:ir.animation_states && ir.animation_states[e.id] || ir.flow[e.id]}); if (--degree[e.to] === 0) queue.push(e.to); }); }
    return plan;
  }
  function attach(host, ir, options) {
    if (ir.diagram_type === 'l0_summary') return { stop:function(){}, dispose:function(){} };
    ir = global.DDS.withAutoFolds(ir);
    var animationEnabled = ir.diagram_type === 'l1_full';
    options = options || {}; var svg, rendered, cancel = null, listeners = [], foldLabels = [], collapsed = (options.collapse || []).slice(), expanded = (options.expand || []).slice();
    var level = options.level == null ? (ir.diagram_type === 'l0_summary' ? 0 : 1) : options.level;
    var status = document.createElement('span'), controls = document.createElement('div');
    controls.className = 'dds-controls'; status.setAttribute('aria-live','polite'); host.before(controls);
    function listen(el, event, fn) { el.addEventListener(event,fn); listeners.push(function () { el.removeEventListener(event,fn); }); }
    function stop() { if (cancel) cancel(); cancel = null; status.textContent = ''; }
    function clear() { svg.classList.remove('is-focus'); svg.querySelectorAll('.on').forEach(function (el) { el.classList.remove('on'); }); }
    function project(id) { var n = ir.nodes.find(function (x) { return x.id === id; }); while (n && !rendered.nodes.some(function (x) { return x.id === n.id; })) n = ir.nodes.find(function (x) { return x.id === n.parent; }); return n && n.id; }
    function focus(kind,id) {
      clear(); if (ir.diagram_type === 'l0_summary') return;
      var s = scope(ir,kind,id), visible = new Set(Array.from(s.nodes).map(project)); svg.classList.add('is-focus');
      svg.querySelectorAll('.dds-node').forEach(function (el) { el.classList.toggle('on',visible.has(el.dataset.id)); });
      svg.querySelectorAll('.dds-edge').forEach(function (el) { var e = rendered.edges[Number(el.dataset.i)]; el.classList.toggle('on',s.edges.has(e.id) || ir.edges.some(function (original) { return s.edges.has(original.id) && project(original.from) === e.from && project(original.to) === e.to; })); });
      svg.querySelectorAll('.dds-region').forEach(function (el) { var group = (rendered.groups || []).find(function (g) { return g.id === el.dataset.id; }); el.classList.toggle('on',!!group && group.members.some(function (id) { return visible.has(id); })); });
    }
    function play(input) {
      if (!animationEnabled) return;
      stop(); focus('node',input);
      var plan = flowPlan(ir,input).map(function (p) {
        var original = ir.edges.find(function (e) { return e.id === p.edge; }), from = project(original.from), to = project(original.to);
        if (from === to) return null;
        var shown = rendered.edges.find(function (e) { return e.id === p.edge; }) || rendered.edges.find(function (e) { return e.from === from && e.to === to; });
        return shown ? {edge:shown.id,label:p.label} : null;
      }).filter(Boolean), at = 0, frame = null, stopped = false;
      var ns = 'http://www.w3.org/2000/svg', token = document.createElementNS(ns,'g'), rect = document.createElementNS(ns,'rect'), text = document.createElementNS(ns,'text');
      token.setAttribute('class','dds-token'); token.style.pointerEvents = 'none'; rect.setAttribute('height','24'); rect.setAttribute('rx','8'); rect.setAttribute('fill','#0969DA'); text.setAttribute('fill','white'); text.setAttribute('text-anchor','middle'); token.append(rect,text); svg.append(token);
      cancel = function () { stopped = true; if (frame !== null) global.cancelAnimationFrame(frame); token.remove(); };
      function step() {
        if (stopped) return;
        if (at === plan.length) { stop(); return; }
        var p = plan[at++], index = rendered.edges.findIndex(function (e) { return e.id === p.edge; });
        var path = svg.querySelector('.dds-edge[data-i="'+index+'"] path'), len = path.getTotalLength(), start;
        text.textContent = p.label; status.textContent = p.label;
        var width = Math.max(64, Array.from(p.label).length * 14 + 24); rect.setAttribute('width',width); rect.setAttribute('x',-width/2); rect.setAttribute('y',-16); text.setAttribute('y',1);
        var reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
        function tick(now) { if (stopped) return; if (start === undefined) start = now; var t = Math.min(1,(now-start)/1800), pos = path.getPointAtLength(len * (reduced ? 0.5 : t)); token.setAttribute('transform','translate('+pos.x+','+pos.y+')'); if (t < 1) frame = global.requestAnimationFrame(tick); else step(); }
        frame = global.requestAnimationFrame(tick);
      }
      step();
    }
    function bind() {
      svg = host.querySelector('svg'); rendered = global.DDS.view(ir,level,{expand:expanded,collapse:collapsed});
      svg.querySelectorAll('.dds-node,.dds-edge').forEach(function (el) {
        var node = el.classList.contains('dds-node'), edge = node ? null : rendered.edges[Number(el.dataset.i)];
        var id = node ? el.dataset.id : ir.edges.filter(function (e) { return project(e.from) === edge.from && project(e.to) === edge.to; }).map(function (e) { return e.id; });
        el.setAttribute('tabindex','0');
        var enter = function () { stop(); focus(node ? 'node':'edge',id); if (animationEnabled && node && ir.e2e.inputs.includes(id)) play(id); };
        var leave = function () { stop(); clear(); };
        listen(el,'mouseenter',enter); listen(el,'mouseleave',leave); listen(el,'focus',enter); listen(el,'blur',leave);
      });
      svg.querySelectorAll('.dds-plus').forEach(function (el) {
        el.setAttribute('role','button'); el.setAttribute('tabindex','0'); el.setAttribute('aria-label','펼치기: '+el.dataset.expand);
        var expand = function (event) { event.stopPropagation(); toggle(el.dataset.expand); };
        listen(el,'click',expand); listen(el,'keydown',function (event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); expand(event); } });
      });
    }
    function toggle(id) {
      var n = ir.nodes.find(function (n) { return n.id === id; });
      var closed = collapsed.includes(id) || (!expanded.includes(id) && level < n.expandAt);
      collapsed = collapsed.filter(function (x) { return x !== id; }); expanded = expanded.filter(function (x) { return x !== id; });
      (closed ? expanded : collapsed).push(id); foldLabels.forEach(function (label) { label(); }); redraw();
    }
    function redraw() {
      stop(); listeners.splice(0).forEach(function (off) { off(); });
      host.innerHTML = global.DDS.render(ir,{level:level,expand:expanded,collapse:collapsed,fit:true,pad:24}).svg; bind();
    }
    var foldNodes = ir.nodes.filter(function (n) { return n.expandAt !== undefined; });
    if (foldNodes.length > 1 || (foldNodes.length && ir.diagram_type === 'l1_full')) {
      var expandAll = document.createElement('button'); expandAll.textContent = '모두 펼치기';
      expandAll.onclick = function () {
        var ids = foldNodes.map(function(n){return n.id;});
        collapsed = collapsed.filter(function(id){return !ids.includes(id);});
        expanded = Array.from(new Set(expanded.concat(ids))); redraw();
      }; controls.append(expandAll);
      var collapseAll = document.createElement('button'); collapseAll.textContent = '모두 접기';
      collapseAll.onclick = function () {
        var ids = foldNodes.map(function (n) { return n.id; });
        expanded = expanded.filter(function (id) { return !ids.includes(id); });
        collapsed = Array.from(new Set(collapsed.concat(ids))); redraw();
      }; controls.append(collapseAll);
    } else foldNodes.forEach(function (n) {
      var button = document.createElement('button');
      function isClosed() { return collapsed.includes(n.id) || (!expanded.includes(n.id) && level < n.expandAt); }
      function label() { button.textContent = (isClosed() ? '펼치기: ' : '접기: ')+n.label; }
      label(); foldLabels.push(label); button.onclick = function () { toggle(n.id); }; controls.append(button);
    });
    controls.append(status); bind();
    return { stop:stop, dispose:function () { stop(); listeners.splice(0).forEach(function (off) { off(); }); controls.remove(); } };
  }
  global.DDSWorkflow = { scope:scope, flowPlan:flowPlan, attach:attach };
})(typeof window !== 'undefined' ? window : globalThis);
