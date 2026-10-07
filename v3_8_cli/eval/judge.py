#!/usr/bin/env python3
"""Judge for GC-1/3/4 runs, implementing JUDGE_CRITERIA.md (V0, J1..J13).
Rules are deterministic; the LLM only fills slots (twice, independently; disagreement -> HOLD H-SLOT; a failed LLM call -> HOLD H-LLM).
Usage: judge.py judge <run_dir> | judge.py selftest [--quick]"""
import threading, time, colorsys, difflib, hashlib, html as htmlmod, json, math, os, re, shutil, subprocess, sys, tempfile
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
TMP = '/private/tmp/drd-judge'
TOPICS = ['l0_or_render_feedback', 'output_format', 'grouping', 'information_amount', 'exception_branch',
          'entity_insertion', 'label_wording', 'layout', 'abstraction_level', 'certainty', 'split', 'grouping_criterion']
# topics whose answer can cover a deviation of kind 1 group / 2 omit-fold / 3 split / 4 extra node
DEV_TOPICS = {1: {'grouping', 'grouping_criterion', 'information_amount'}, 2: {'information_amount', 'grouping'},
              3: {'split', 'information_amount'}, 4: {'exception_branch', 'entity_insertion', 'information_amount'}}
MARK = re.compile(r'미정|제안|잠정|임시|\(안\)|\[안\]')
# J4/J7 source reference outside the request (RS (a): 'undeterminable' when attachment is absent from evidence)
SRC_REF = re.compile(r'첨부(?:한|된)?\s*(?:\S+\s*)?문서|(?:설계|기획|명세|요구)\s*문서|첨부\S*|문서(?:대로|에\s*따라)|코드(?:대로|에\s*따라)|파일(?:대로|을\s*보고)')

# ---- section 2 facts (request + design system only) ----
def _chain(*xs): return list(zip(xs, xs[1:]))
FACTS = {
 'GC-1': dict(html=False, P=['재고 확인', '카드 인증', '승인 요청', '배송 요청'], E=['주문'], PE=['결제', '배송 완료 알림'],
              edges=_chain('주문', '재고 확인', '결제', '배송 요청', '배송 완료 알림') + [('카드 인증', '승인 요청')],
              rank={'주문': 0, '재고 확인': 1, '결제': 2, '카드 인증': 2, '승인 요청': 3, '배송 요청': 4, '배송 완료 알림': 5},
              branch={}, whole_part=('결제', ['카드 인증', '승인 요청']), redundant_topics={'grouping'}, nodes=(6, 12)),
 'GC-3': dict(html=True, P=['수집', '정제', '적재'], E=['주문 DB', '회원 DB', '재고 DB', '결제 로그', '배송 로그', 'CRM', '고객센터 티켓',
              '앱 로그', '웹 로그', '광고 API', '날씨 API', '환율 API'], PE=['대시보드'], whole_part=None, redundant_topics=set(), nodes=(4, 16)),
 'GC-4': dict(html=True, P=['결제 승인', '정산', '출고', '배송 추적', '리뷰 요청', '평점 반영'], E=['주문', '정산 보고서', '리뷰', '상품 평점'],
              PE=['배송 완료'], edges=[('주문', '결제 승인'), ('결제 승인', '정산'), ('정산', '정산 보고서'), ('주문', '출고')] +
              _chain('출고', '배송 추적', '배송 완료', '리뷰 요청', '리뷰', '평점 반영', '상품 평점'), whole_part=None, redundant_topics=set(), nodes=(1, 11)),
}
_src = ['주문 DB', '회원 DB', '재고 DB', '결제 로그', '배송 로그', 'CRM', '고객센터 티켓', '앱 로그', '웹 로그', '광고 API', '날씨 API', '환율 API']
FACTS['GC-3']['edges'] = [(s, '수집') for s in _src] + _chain('수집', '정제', '적재', '대시보드')
FACTS['GC-3']['rank'] = {**{s: 0 for s in _src}, '수집': 1, '정제': 2, '적재': 3, '대시보드': 4}
FACTS['GC-3']['branch'] = {s: 'src' for s in _src}          # lateral edges forbidden inside a branch group
FACTS['GC-3']['branch_nolateral'] = True
_a = ['결제 승인', '정산', '정산 보고서']; _b = ['출고', '배송 추적', '배송 완료', '리뷰 요청', '리뷰', '평점 반영', '상품 평점']
FACTS['GC-4']['rank'] = {'주문': 0, **{x: i + 1 for i, x in enumerate(_a)}, **{x: i + 1 for i, x in enumerate(_b)}}
FACTS['GC-4']['branch'] = {**{x: 'A' for x in _a}, **{x: 'B' for x in _b}}
for _f in FACTS.values():
    _f['labels'] = _f['P'] + _f['E'] + _f['PE']

def norm(s): return re.sub(r'[\s\W_]+', '', s or '')

# ================= colours =================
NAMED = {'black': (0, 0, 0), 'white': (255, 255, 255), 'red': (255, 0, 0), 'green': (0, 128, 0), 'blue': (0, 0, 255),
         'gray': (128, 128, 128), 'grey': (128, 128, 128), 'currentcolor': (0, 0, 0)}
def col(s):
    """-> None (transparent/none), 'url', or (r,g,b)."""
    s = (s or '').strip().lower()
    if s in ('', 'none', 'transparent', 'initial', 'inherit'): return None
    if s.startswith('url'): return 'url'
    if s in NAMED: return NAMED[s]
    m = re.match(r'#([0-9a-f]{3}|[0-9a-f]{6})$', s)
    if m:
        h = m.group(1); h = ''.join(c * 2 for c in h) if len(h) == 3 else h
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    m = re.match(r'rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.%]+))?\s*\)', s)
    if m:
        a = m.group(4)
        if a is not None and float(a.rstrip('%')) == 0: return None
        return tuple(int(float(m.group(i))) for i in (1, 2, 3))
    return 'url'
def is_bg(c, bgs): return c is None or c == (255, 255, 255) or c in bgs
def palette_ok(c):
    if not isinstance(c, tuple): return True
    h, s, v = colorsys.rgb_to_hsv(*(x / 255 for x in c))
    if s < 0.15: return True
    h *= 360
    return h >= 345 or h <= 15 or 90 <= h <= 150 or 200 <= h <= 250
def hexs(c): return '#%02x%02x%02x' % c if isinstance(c, tuple) else str(c)
def dashed(d): return (d or 'none').strip().lower() not in ('none', '', '0', '0px', 'normal')

# ================= extraction =================
class RenderError(Exception): pass

JS = r"""
(function(){
function vis(el){for(let e=el;e&&e.nodeType==1;e=e.parentElement){const c=getComputedStyle(e);if(c.display==='none'||c.visibility==='hidden'||parseFloat(c.opacity)===0)return false;}return true;}
function pt(m,x,y){return m?[x*m.a+y*m.c+m.e,x*m.b+y*m.d+m.f]:[x,y];}
const SKIP='defs,marker,clipPath,mask,pattern,symbol,script,style,title,desc,head,noscript';
function texts(){const out=[];const tw=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
 while(n=tw.nextNode()){const t=n.textContent.replace(/\s+/g,' ').trim();if(!t)continue;const p=n.parentElement;if(!p||p.closest(SKIP)||!vis(p))continue;
  const r=document.createRange();r.selectNodeContents(n);const b=r.getBoundingClientRect();if(b.width*b.height<=0)continue;const cs=getComputedStyle(p);
  out.push({t:t,x:b.left,y:b.top,w:b.width,h:b.height,fill:(p instanceof SVGElement)?cs.fill:cs.color});}
 return out;}
function collect(){
 const R={texts:texts(),shapes:[],edges:[]};
 const W=document.documentElement.scrollWidth,H=document.documentElement.scrollHeight;
 for(const el of document.body.querySelectorAll('*')){
  if(el.closest(SKIP)||!vis(el))continue;const tag=el.tagName.toLowerCase();const cs=getComputedStyle(el);
  if(el instanceof SVGElement){
   const m=el.getScreenCTM?el.getScreenCTM():null;const sc=m?Math.abs(m.a):1;
   if(['rect','ellipse','circle','polygon'].indexOf(tag)>=0){const b=el.getBoundingClientRect();if(b.width<4||b.height<4)continue;
    if(tag==='polygon'&&b.width<14&&b.height<14)continue;
    let rx=0;if(tag==='rect')rx=(parseFloat(cs.rx)||parseFloat(el.getAttribute('rx'))||0)*sc;else if(tag!=='polygon')rx=Math.min(b.width,b.height)/2;
    R.shapes.push({tag:tag,x:b.left,y:b.top,w:b.width,h:b.height,rx:rx,fill:cs.fill,stroke:cs.stroke,dash:cs.strokeDasharray});}
   else if(['line','polyline','path'].indexOf(tag)>=0){
    let p0,p1,d=el.getAttribute('d')||'';
    try{if(tag==='path'){const L=el.getTotalLength();const a=el.getPointAtLength(0),b=el.getPointAtLength(L);p0=pt(m,a.x,a.y);p1=pt(m,b.x,b.y);}
     else if(tag==='line'){p0=pt(m,el.x1.baseVal.value,el.y1.baseVal.value);p1=pt(m,el.x2.baseVal.value,el.y2.baseVal.value);}
     else{const ps=el.points;p0=pt(m,ps[0].x,ps[0].y);p1=pt(m,ps[ps.length-1].x,ps[ps.length-1].y);}}catch(e){continue;}
    R.edges.push({p0:p0,p1:p1,d:d,dash:cs.strokeDasharray,stroke:cs.stroke,marker:(cs.markerEnd&&cs.markerEnd!=='none')||(cs.markerStart&&cs.markerStart!=='none'),curve:/[CcQqSsAaTt]/.test(d),fill:cs.fill});}
  } else {
   if(el===document.body||el===document.documentElement)continue;const b=el.getBoundingClientRect();
   const bw=parseFloat(cs.borderTopWidth)>0&&cs.borderTopStyle!=='none',bg=cs.backgroundColor;
   if((bw||(bg&&!/rgba\(.*, 0\)|transparent/.test(bg)))&&b.width>=6&&b.height>=6&&!(b.width>=W*0.95&&b.height>=H*0.95)){
    let r=cs.borderTopLeftRadius,rx=parseFloat(r)||0;if(/%/.test(r))rx=rx/100*Math.min(b.width,b.height);
    R.shapes.push({tag:'html',x:b.left,y:b.top,w:b.width,h:b.height,rx:rx,fill:bg,stroke:bw?cs.borderTopColor:'none',dash:(cs.borderTopStyle==='dashed'||cs.borderTopStyle==='dotted')?'4 4':'none'});}}
 }
 return R;}
function bgs(){const o=[getComputedStyle(document.documentElement).backgroundColor,getComputedStyle(document.body).backgroundColor];
 for(const s of document.querySelectorAll('svg'))o.push(s.style.background||'');return o;}
function selNoPseudo(s){return s.replace(/:(hover|focus|focus-within|active)/g,'').trim()||'*';}
function hoverRules(){let n=0;const walk=(rules)=>{for(const r of rules){if(r.cssRules&&!r.selectorText)walk(r.cssRules);
  else if(r.selectorText&&/:(hover|focus|focus-within)/.test(r.selectorText)){try{if(document.querySelector(selNoPseudo(r.selectorText)))n++;}catch(e){}}}};
 for(const sh of document.styleSheets){try{walk(sh.cssRules);}catch(e){}}return n;}
function snap(){return Array.from(document.querySelectorAll('body *')).map(function(e){const c=getComputedStyle(e);
  return e.tagName+c.opacity+c.display+c.visibility+c.fill+c.stroke+c.strokeWidth+c.backgroundColor+c.transform+c.filter+c.strokeDasharray;}).join('|')+'##'+document.body.innerText;}
function run(){
 const out=collect();out.bgs=bgs();out.errs=window.__errs||[];out.hover_rules=hoverRules();
 const html=document.documentElement.outerHTML;
 out.hover_js=/\son(mouse|pointer)(over|enter|move)=|addEventListener\(\s*['"](mouse|pointer)(over|enter|move)/.test(html);
 out.click_js=/\sonclick=|addEventListener\(\s*['"]click|\.onclick\s*=/.test(html)||!!document.querySelector('details,input[type=checkbox],input[type=radio]');
 document.addEventListener('click',e=>e.preventDefault(),true);
 const els=Array.from(document.body.querySelectorAll('*')).filter(e=>!e.closest(SKIP)).slice(0,200);
 const base=snap();let hc=false,cc=false;const seen=new Set(out.texts.map(t=>t.t));
 for(const e of els){try{['mouseover','mouseenter','mousemove','pointerover'].forEach(t=>e.dispatchEvent(new MouseEvent(t,{bubbles:true})));
   if(snap()!==base){hc=true;texts().forEach(t=>seen.add(t.t));}
   ['mouseout','mouseleave','pointerout'].forEach(t=>e.dispatchEvent(new MouseEvent(t,{bubbles:true})));}catch(x){}}
 const b2=snap();
 for(const e of els){try{e.dispatchEvent(new MouseEvent('click',{bubbles:true}));if(snap()!==b2){cc=true;}texts().forEach(t=>seen.add(t.t));}catch(x){}}
 out.hover_changed=hc;out.click_changed=cc;out.texts_probe=Array.from(seen);
 const pre=document.createElement('pre');pre.id='__DRD__';pre.textContent=JSON.stringify(out);document.body.appendChild(pre);}
addEventListener('load',function(){setTimeout(function(){try{run();}catch(e){const pre=document.createElement('pre');pre.id='__DRD__';pre.textContent=JSON.stringify({error:String(e)});document.body.appendChild(pre);}},400);});
})();
"""

def chrome_extract(path):
    src = open(path, encoding='utf-8', errors='replace').read()
    base = '<base href="file://%s/">' % os.path.dirname(os.path.abspath(path))
    pre = base + '<style>*{transition:none!important;animation:none!important}</style>' + '<script>window.__errs=[];addEventListener("error",function(e){__errs.push(String(e.message))})</script>'
    src = re.sub(r'(<head[^>]*>)', lambda m: m.group(1) + pre, src, count=1, flags=re.I) if re.search(r'<head', src, re.I) else pre + src
    src += '<script>' + JS + '</script>'
    os.makedirs(TMP, exist_ok=True)
    d = tempfile.mkdtemp(dir=TMP)
    try:
        f = os.path.join(d, 'x.html'); open(f, 'w', encoding='utf-8').write(src)
        proc = subprocess.Popen([CHROME, '--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + os.path.join(d, 'u'),
                                 '--virtual-time-budget=5000', '--window-size=1600,1200', '--dump-dom', 'file://' + f],
                                stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, start_new_session=True)
        buf = []
        def pump():
            for line in proc.stdout: buf.append(line)
        th = threading.Thread(target=pump, daemon=True); th.start()
        t0 = time.time()                      # chrome may linger ~30 s after printing the DOM, so stop as soon as </html> arrived
        while time.time() - t0 < 90 and not (buf and '</html>' in ''.join(buf[-3:])): time.sleep(0.2)
        stdout = ''.join(buf)
        try: os.killpg(proc.pid, 9)
        except OSError: pass
        if '</html>' not in stdout: raise RenderError('chrome timeout')
        p = type('P', (), dict(stdout=stdout, returncode=0))
    except Exception as e:
        raise RenderError(str(e))
    finally:
        shutil.rmtree(d, ignore_errors=True)
    m = re.search(r'<pre id="__DRD__">(.*?)</pre>', p.stdout, re.S)
    if not m: raise RenderError('no extraction output (chrome rc=%s)' % p.returncode)
    x = json.loads(htmlmod.unescape(m.group(1)))
    if 'error' in x: raise RenderError(x['error'])
    return x

# ---- SVG via XML parser ----
def _mat(t):
    m = (1, 0, 0, 1, 0, 0)
    for name, args in re.findall(r'(\w+)\s*\(([^)]*)\)', t or ''):
        a = [float(v) for v in re.split(r'[ ,]+', args.strip()) if v]
        if name == 'translate': n = (1, 0, 0, 1, a[0], a[1] if len(a) > 1 else 0)
        elif name == 'scale': n = (a[0], 0, 0, a[1] if len(a) > 1 else a[0], 0, 0)
        elif name == 'matrix' and len(a) == 6: n = tuple(a)
        else: continue
        m = (m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
             m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5])
    return m
def _ap(m, x, y): return (m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5])
def _css(text):
    rules = []
    for sel, body in re.findall(r'([^{}]+)\{([^}]*)\}', re.sub(r'/\*.*?\*/', '', text, flags=re.S)):
        props = dict((k.strip(), v.strip()) for k, v in re.findall(r'([\w-]+)\s*:\s*([^;]+)', body))
        for s in sel.split(','): rules.append((s.strip(), props))
    return rules
def _path_pts(d):
    toks = re.findall(r'[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?', d)
    pts, i, cmd, cur, start = [], 0, 'M', (0.0, 0.0), (0.0, 0.0)
    def num():
        nonlocal i; v = float(toks[i]); i += 1; return v
    while i < len(toks):
        if re.match(r'[A-Za-z]', toks[i]): cmd = toks[i]; i += 1
        if cmd in 'Zz': cur = start; continue
        rel = cmd.islower(); c = cmd.upper()
        try:
            if c in 'ML': x, y = num(), num(); cur = (cur[0] + x, cur[1] + y) if rel else (x, y); pts.append(cur); start = cur if c == 'M' and len(pts) == 1 or c == 'M' else start
            elif c == 'H': x = num(); cur = (cur[0] + x if rel else x, cur[1]); pts.append(cur)
            elif c == 'V': y = num(); cur = (cur[0], cur[1] + y if rel else y); pts.append(cur)
            elif c in 'CSQTA':
                n = {'C': 6, 'S': 4, 'Q': 4, 'T': 2, 'A': 7}[c]; v = [num() for _ in range(n)]
                cur = (cur[0] + v[-2], cur[1] + v[-1]) if rel else (v[-2], v[-1]); pts.append(cur)
            else: i += 1
        except (IndexError, ValueError): break
        if c == 'M': cmd = 'l' if rel else 'L'
    return pts

def extract_svg(path):
    tree = ET.parse(path); root = tree.getroot()
    for e in root.iter(): e.tag = e.tag.split('}')[-1] if isinstance(e.tag, str) else e.tag
    rules = []; hover_rules = 0; script = False
    for e in root.iter():
        if e.tag == 'style': rules += _css(e.text or '')
        if e.tag == 'script': script = True
    hover_rules = sum(1 for s, _ in rules if re.search(r':(hover|focus)', s))
    rules = [(s, p) for s, p in rules if ':' not in s]
    INH = ('fill', 'stroke', 'stroke-dasharray', 'font-size', 'text-anchor', 'marker-end', 'opacity')
    out = dict(texts=[], shapes=[], edges=[], bgs=[], errs=[], hover_rules=hover_rules, hover_js=script or any(k.startswith('onmouse') for e in root.iter() for k in e.attrib),
               click_js=script or any(k == 'onclick' for e in root.iter() for k in e.attrib), hover_changed=False, click_changed=False, texts_probe=[])
    def props(e, inh):
        p = dict(inh)
        for k, v in e.attrib.items(): p[k] = v
        for s, r in rules:
            if (s.startswith('.') and s[1:] in (e.get('class') or '').split()) or s == e.tag or (s.startswith('#') and s[1:] == e.get('id')): p.update(r)
        for k, v in re.findall(r'([\w-]+)\s*:\s*([^;]+)', e.get('style') or ''): p[k.strip()] = v.strip()
        return p
    bg = re.search(r'background\s*:\s*([^;]+)', root.get('style') or '')
    out['bgs'] = [bg.group(1).strip()] if bg else []
    vb = [float(v) for v in re.split(r'[ ,]+', root.get('viewBox', '').strip()) if v]
    root_m = (1, 0, 0, 1, -vb[0], -vb[1]) if len(vb) == 4 else (1, 0, 0, 1, 0, 0)
    def walk(e, m, inh):
        if e.tag in ('defs', 'marker', 'clipPath', 'mask', 'pattern', 'symbol', 'style', 'script', 'title', 'desc'): return
        m = _mat(e.get('transform')) and _cat(m, _mat(e.get('transform')))
        p = props(e, {k: v for k, v in inh.items() if k in INH})
        if p.get('display') == 'none' or p.get('visibility') == 'hidden': return
        f = lambda k, d=0.0: float(re.sub(r'[a-z%]+$', '', str(e.get(k) or d)) or d)
        sc = abs(m[0])
        if e.tag in ('rect', 'ellipse', 'circle', 'polygon'):
            if e.tag == 'rect': x, y, w, h = f('x'), f('y'), f('width'), f('height'); rx = f('rx', f('ry')) * sc; pts = [(x, y), (x + w, y + h)]
            elif e.tag == 'ellipse': pts = [(f('cx') - f('rx'), f('cy') - f('ry')), (f('cx') + f('rx'), f('cy') + f('ry'))]; rx = 1e9
            elif e.tag == 'circle': pts = [(f('cx') - f('r'), f('cy') - f('r')), (f('cx') + f('r'), f('cy') + f('r'))]; rx = 1e9
            else:
                nums = [float(v) for v in re.findall(r'-?\d*\.?\d+', e.get('points') or '')]; xy = list(zip(nums[::2], nums[1::2])); rx = 0
                pts = [(min(a for a, _ in xy), min(b for _, b in xy)), (max(a for a, _ in xy), max(b for _, b in xy))] if xy else []
            if pts:
                (x0, y0), (x1, y1) = _ap(m, *pts[0]), _ap(m, *pts[1]); w, h = abs(x1 - x0), abs(y1 - y0)
                if w >= 4 and h >= 4 and not (e.tag == 'polygon' and w < 14 and h < 14):
                    out['shapes'].append(dict(tag=e.tag, x=min(x0, x1), y=min(y0, y1), w=w, h=h, rx=min(rx, w, h) if rx < 1e8 else min(w, h) / 2,
                                              fill=p.get('fill', 'black'), stroke=p.get('stroke', 'none'), dash=p.get('stroke-dasharray', 'none')))
        elif e.tag in ('line', 'polyline', 'path'):
            if e.tag == 'line': pts = [(f('x1'), f('y1')), (f('x2'), f('y2'))]
            elif e.tag == 'polyline': nums = [float(v) for v in re.findall(r'-?\d*\.?\d+', e.get('points') or '')]; pts = list(zip(nums[::2], nums[1::2]))
            else: pts = _path_pts(e.get('d') or '')
            if len(pts) >= 2:
                mk = p.get('marker-end') or p.get('marker-start')
                out['edges'].append(dict(p0=_ap(m, *pts[0]), p1=_ap(m, *pts[-1]), d=e.get('d') or '', dash=p.get('stroke-dasharray', 'none'), stroke=p.get('stroke', 'none'),
                                         marker=bool(mk and mk != 'none'), curve=bool(re.search(r'[CcQqSsAaTt]', e.get('d') or '')), fill=p.get('fill', 'black')))
        elif e.tag == 'text':
            fs = float(re.sub(r'[a-z]+$', '', str(p.get('font-size', 14))) or 14) * sc
            parts = [(e, ''.join(e.itertext()))] if not [c for c in e if c.tag == 'tspan' and c.get('x')] else [(c, ''.join(c.itertext())) for c in e if c.tag == 'tspan']
            for node, txt in parts:
                t = re.sub(r'\s+', ' ', txt).strip()
                if not t: continue
                x, y = _ap(m, float(node.get('x') or e.get('x') or 0), float(node.get('y') or e.get('y') or 0))
                w = sum(fs * (1.0 if ord(ch) > 0x2E80 else 0.55) for ch in t); a = p.get('text-anchor', 'start')
                x0 = x - w / 2 if a == 'middle' else x - w if a == 'end' else x
                out['texts'].append(dict(t=t, x=x0, y=y - fs * 0.85, w=w, h=fs * 1.05, fill=p.get('fill', 'black')))
            return
        for c in e: walk(c, m, p)
    def _cat(a, b):
        return (a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
                a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5])
    walk(root, root_m, {})
    return out

# ================= structure analysis =================
def dist_pt_rect(px, py, s):
    dx = max(s['x'] - px, 0, px - (s['x'] + s['w'])); dy = max(s['y'] - py, 0, py - (s['y'] + s['h']))
    return math.hypot(dx, dy)
def inside(s, o, pad=1.5): return s['x'] >= o['x'] - pad and s['y'] >= o['y'] - pad and s['x'] + s['w'] <= o['x'] + o['w'] + pad and s['y'] + s['h'] <= o['y'] + o['h'] + pad
def center(o): return o['x'] + o['w'] / 2, o['y'] + o['h'] / 2
def area(o): return o['w'] * o['h']

def analyze(X):
    """X -> pic: nodes, regions, edges (with endpoint attribution), colours."""
    bgs = {c for c in (col(b) for b in X.get('bgs', [])) if isinstance(c, tuple)}
    texts, shapes, edges = list(X['texts']), list(X['shapes']), list(X['edges'])
    # legend exclusion
    for t in [t for t in texts if re.search(r'범례|legend', t['t'], re.I)]:
        cx, cy = center(t); cont = [s for s in shapes if s['x'] <= cx <= s['x'] + s['w'] and s['y'] <= cy <= s['y'] + s['h']]
        box = min(cont, key=area) if cont else t
        keep = lambda o: not inside(o, box, 2) if o is not t else False
        texts = [o for o in texts if keep(o)]; shapes = [o for o in shapes if keep(o)]
        edges = [e for e in edges if not (box['x'] <= e['p0'][0] <= box['x'] + box['w'] and box['y'] <= e['p0'][1] <= box['y'] + box['h'])]
    for s in shapes: s['ratio'] = s['rx'] / s['h'] if s['h'] else 0; s['kids'] = []; s['texts'] = []
    # drop a shape that is the root background (covers every other shape and has no text/stroke)
    for t in texts:
        cx, cy = center(t); cont = [s for s in shapes if s['x'] <= cx <= s['x'] + s['w'] and s['y'] <= cy <= s['y'] + s['h']]
        if cont: min(cont, key=area)['texts'].append(t)
    for s in shapes:
        s['inner'] = [o for o in shapes if o is not s and inside(o, s) and area(o) < area(s) * 0.98 and o['texts']]
    regions = [s for s in shapes if len(s['inner']) >= 2]
    nodes = [s for s in shapes if s['texts'] and s not in regions]
    for s in regions + nodes:
        s['label'] = ' '.join(t['t'] for t in sorted(s['texts'], key=lambda t: (round(t['y'] / 6), t['x'])))
        s['shape'] = 'stadium' if (s['tag'] in ('ellipse', 'circle') and False) else ('stadium' if s['ratio'] >= 0.45 and s['tag'] != 'html' or (s['tag'] == 'html' and s['ratio'] >= 0.45) else 'rect')
        if s['tag'] in ('ellipse', 'circle'): s['shape'] = 'ellipse'
    for r in regions: r['children'] = [n for n in nodes if inside(n, r)]; r['own_texts'] = len(r['texts'])
    targets = nodes + regions
    es = []
    for e in edges:
        if math.hypot(e['p1'][0] - e['p0'][0], e['p1'][1] - e['p0'][1]) < 10: continue
        ends = []
        for p in (e['p0'], e['p1']):
            if not targets: ends.append(None); continue
            best = min(targets, key=lambda s: (round(dist_pt_rect(p[0], p[1], s), 1), s in regions))
            ends.append(best if dist_pt_rect(p[0], p[1], best) <= 30 else None)
        if ends[0] is not None and ends[0] is ends[1]: continue        # decorative mark inside a single node
        e['src'], e['dst'] = ends
        # arrowhead: marker or a small triangle polygon near the end point
        if not e['marker']:
            for s in shapes:
                if s['tag'] == 'polygon' and s['w'] < 14 and s['h'] < 14 and math.hypot(center(s)[0] - e['p1'][0], center(s)[1] - e['p1'][1]) < 12: e['marker'] = True
        es.append(e)
    # polygons dropped as arrowheads are already excluded from shapes, so re-check raw tiny polygons is not needed for XML/JS (they are skipped)
    return dict(nodes=nodes, regions=regions, edges=es, texts=texts, bgs=bgs, raw=X,
                labels=[norm(n['label']) for n in nodes + regions], text_set={norm(t['t']) for t in texts})

# ================= LLM slots =================
def _parse_json(s):
    s = re.sub(r'^```(?:json)?|```$', '', s.strip(), flags=re.M).strip()
    i, j = s.find('{'), s.rfind('}')
    return json.loads(s[i:j + 1])
SEQ = os.environ.get('JUDGE_SEQ') == '1'   # run fixtures and the two slot fills one at a time (rate limits)
_tl = threading.local()      # selftest fault injection: replaces llm() for the calling judge run only
def llm(prompt):
    os.makedirs(TMP, exist_ok=True)
    for _ in range(4):
        d = tempfile.mkdtemp(dir=TMP)
        try:
            p = subprocess.run(['claude', '-p', prompt, '--model', 'haiku', '--output-format', 'json', '--setting-sources', 'project',
                                '--disallowedTools', 'Bash Read Write Edit Glob Grep Skill'], cwd=d, capture_output=True, text=True, timeout=240, stdin=subprocess.DEVNULL)
            return _parse_json(json.loads(p.stdout)['result'])
        except Exception:
            if SEQ: time.sleep(30 * 2 ** _)
            continue
        finally:
            shutil.rmtree(d, ignore_errors=True)
    return None
def slot(prompt, canon, both=False):
    """Fill twice independently. -> (value, None), (None, 'H-SLOT') on disagreement, (None, 'H-LLM') when a call itself failed."""
    fn = getattr(_tl, 'fn', None) or llm
    with ThreadPoolExecutor(1 if SEQ else 2) as ex: r = list(ex.map(lambda _: fn(prompt), range(2)))
    if any(x is None for x in r): return None, 'H-LLM'
    try: c = [canon(x) for x in r]
    except Exception: return None, 'H-SLOT'
    return ((r if both else r[0]), None) if c[0] == c[1] else (None, 'H-SLOT')

def slot_alias(req, label):
    p = ('JSON 으로만 답하라. 요청 문장에 나온 요소 이름 A 와 도식에 그려진 라벨 B 가 같은 이름(철자·띄어쓰기·조사 차이만 있는 같은 말)인지 판정하라. '
         '의미가 비슷해도 다른 낱말이면 different.\nA: %s\nB: %s\n출력: {"alias":"same"} 또는 {"alias":"different"}' % (req, label))
    v, why = slot(p, lambda j: j['alias'] if j['alias'] in ('same', 'different') else 1 / 0)
    return (v['alias'] if v else None), why

def slot_deviations(request, pic_labels, regions, cands):
    p = ('JSON 으로만 답하라. 아래 [요청문]에서 그려 달라고 한 요소는 요청어이다. [도식]의 후보 라벨 각각이, 요청문에 없는 구조 결정인지 분류하라.\n'
         '분류: 1=묶음(요청문이 정하지 않은 영역/그룹으로 여러 노드를 묶음), 3=여러 장/페이지 분할, 4=요청에 없는 노드·갈래 추가, 0=해당 없음(요청어의 단순 표기 변형 포함).\n'
         '요청문이 명시한 묶음(예: "결제는 카드 인증과 승인 요청 두 단계")은 0 이다. quote 는 반드시 아래 후보 라벨 중 하나를 글자 그대로 쓴다. 0 인 것은 쓰지 않는다.\n'
         '[요청문] %s\n[도식 전체 라벨] %s\n[영역(region) 라벨과 안의 노드] %s\n[후보 라벨] %s\n'
         '출력: {"items":[{"kind":1,"quote":"후보 라벨"}]}  (없으면 {"items":[]})' % (request, json.dumps(pic_labels, ensure_ascii=False),
                                                                        json.dumps(regions, ensure_ascii=False), json.dumps(cands, ensure_ascii=False)))
    ok = {norm(c): c for c in cands}
    def clean(j): return sorted({(int(i['kind']), norm(i['quote'])) for i in j['items'] if int(i['kind']) in (1, 3, 4) and norm(i['quote']) in ok})
    v, why = slot(p, clean)
    return (clean(v) if v else None), why, ok

def slot_source_undecided(src, elems):
    """RS (b) record slot. elems: [(id, description)]. Two independent fills; each element -> 'yes'/'no' per fill ('yes' needs a quote that is literally in the source).
    Disagreement is NOT a hold: both values are recorded as 'yes/no'. -> ({id: str}, None) or (None, 'H-LLM')."""
    p = ('JSON 으로만 답하라. 아래 [원천]은 도식이 표현할 대상을 적은 글이다. [요소] 각각에 대해, 원천이 그 요소의 내용·소속·관계를 아직 정해지지 않은 것(미정)이라고 직접 표현했는지 골라라. '
         '원천에 미정 표현이 없거나 다른 것에 대한 표현이면 고르지 않는다. 도식이나 Agent 의 판단은 근거가 아니다. quote 는 [원천]에서 글자 그대로 옮긴다.\n'
         '[원천] %s\n[요소] %s\n출력: {"undecided":[{"id":"e0","quote":"..."}]}  (없으면 {"undecided":[]})' % (src, json.dumps(elems, ensure_ascii=False)))
    fn = getattr(_tl, 'fn', None) or llm
    with ThreadPoolExecutor(1 if SEQ else 2) as ex: r = list(ex.map(lambda _: fn(p), range(2)))
    if any(x is None for x in r): return None, 'H-LLM'
    ns = norm(src); ids = {i for i, _ in elems}; fills = []
    for j in r:
        try: fills.append({i['id'] for i in j['undecided'] if i['id'] in ids and norm(str(i.get('quote', ''))) and norm(str(i['quote'])) in ns})
        except Exception: fills.append(set())
    return {i: ('yes' if i in fills[0] else 'no') if (i in fills[0]) == (i in fills[1]) else '%s/%s' % ('yes' if i in fills[0] else 'no', 'yes' if i in fills[1] else 'no') for i in ids}, None

def slot_row_basis(row_text):
    p = ('JSON 으로만 답하라. 의미 정합 대조표의 한 행이다. 그 행이 「같다/다르다」고 한 **이유**가 (meaning) 원천 요소·관계의 뜻과 그림이 표현한 뜻을 견준 것인지, '
         '(path) 그림에 이르는 경로(중간 표현·원천 파일·줄·인용 위치·영수증·해시·지문·스크립트·「적은 대로 그렸다」 등 어떻게 만들었는가)의 존재·일치인지 고르라. '
         '판정 단어(같음/일치/OK 등)의 앞머리는 보지 않는다. 「경로(참고)」 열은 참고일 뿐 이유가 아니다.\n[행] %s\n출력: {"row_basis":"meaning"} 또는 {"row_basis":"path"}' % row_text)
    v, why = slot(p, lambda j: j['row_basis'] if j['row_basis'] in ('meaning', 'path') else 1 / 0)
    return (v['row_basis'] if v else None), why

def slot_review_notice(text, x):
    """J8 (c) slot: does the text tell the Human that group X was made by the Agent and awaits Human review? 'yes' needs a quote literally in the text (else counts as 'no').
    -> ('yes'|'no', None) or (None, 'H-SLOT'|'H-LLM')."""
    p = ('JSON 으로만 답하라. 아래 [글]이 Human 에게, 「%s」 은(는) Agent 가 만들었고 Human 이 아직 검토하지 않아 검토를 기다린다는 것을 알리는지 판정하라. '
         '특정 낱말의 유무가 아니라 뜻으로 판정한다. 두 내용이 모두 전달되어야 yes 이다: '
         '(1) 해당 묶음이 Agent 자신의 판단으로 정해졌음, (2) 그 판단에 대한 Human 검토가 아직 남아 있음. '
         '그림을 만들었다는 설명이나 진행 여부를 묻는 질문만으로는 (1)과 (2)를 추론하지 않는다. '
         '전체 묶음을 가리키는 총칭으로 두 내용을 알리면 그 범위에 포함된 개별 묶음에도 적용한다. '
         '개별 라벨의 글자 그대로 반복은 필요 없지만, 다른 특정 묶음만 대상으로 한 고지는 이 묶음에 적용하지 않는다. '
         '이미 검토를 마쳤거나 확정했다고 하면 no 이다. 대상에 적용되는 두 내용이 글에 없으면 no 이다. '
         'yes 이면 quote 에 두 내용을 뒷받침하는 [글]의 연속된 원문을 글자 그대로 옮긴다.\n'
         '[글]\n%s\n출력: {"review_notice":"yes","quote":"..."} 또는 {"review_notice":"no","quote":""}' % (x, text))
    fn = getattr(_tl, 'fn', None) or llm
    with ThreadPoolExecutor(1 if SEQ else 2) as ex: r = list(ex.map(lambda _: fn(p), range(2)))
    if any(x_ is None for x_ in r): return None, 'H-LLM'
    nt = re.sub(r'\s+', '', text); vals = []
    for j in r:
        try:
            v = j['review_notice']
            if v not in ('yes', 'no'): raise ValueError
            if v == 'yes' and not (re.sub(r'\s+', '', str(j.get('quote', ''))) and re.sub(r'\s+', '', str(j.get('quote', ''))) in nt): v = 'no'
            vals.append(v)
        except Exception: return None, 'H-SLOT'
    return (vals[0], None) if vals[0] == vals[1] else (None, 'H-SLOT')

def slot_questions(text):
    p = ('JSON 으로만 답하라. 아래 [메시지]는 agent 가 Human 에게 보낸 것이다. 메시지가 Human 에게 묻는 질문(요청·확인 포함)을 모두 뽑고 각 질문의 topic 을 고르라.\n'
         'topic 후보: %s, other.\n'
         'decided: 그 질문이 agent 가 정한 구조(묶음 등)를 선택지 없이 이미 정해진 것으로 통보하면 true. 선택지·의견 구하기이거나, Agent 결정임을 밝히고 검토를 청하는 것이면 false.\n'
         'quote 는 메시지에서 글자 그대로 옮긴 부분이다.\n[메시지]\n%s\n출력: {"questions":[{"quote":"...","topic":"...","decided":false}]}  (질문이 없으면 빈 배열)' % (', '.join(TOPICS), text))
    # fills are compared on the coarse facts only (asked?, stated-as-decided?); topics are noisy free choices, so both fills' topics are unioned
    def coarse(j): return (bool(j['questions']), any(bool(q['decided']) for q in j['questions']))
    v, why = slot(p, coarse, both=True)
    if why: return None, why
    return sorted({(q['topic'] if q['topic'] in TOPICS else 'other', bool(q['decided'])) for j in v for q in j['questions']}), None

def slot_feedback(answer):
    p = ('JSON 으로만 답하라. 아래 Human 답이 도식에 요구한 변경을 목록으로 뽑아라. 승인·진행 요청만이면 빈 목록.\n'
         'kind: rename(라벨 바꾸기, from/to), remove(라벨 삭제, from), add(라벨 추가, to), other(그 밖의 변경). from/to 는 Human 답에 나온 글자 그대로.\n'
         '[Human 답] %s\n출력: {"changes":[{"kind":"rename","from":"...","to":"..."}]}' % answer)
    def clean(j): return sorted({(c['kind'], norm(c.get('from', '')), norm(c.get('to', ''))) for c in j['changes']})
    v, why = slot(p, clean)
    if v is None: return None, why
    out = [dict(kind=c['kind'], frm=c.get('from', ''), to=c.get('to', '')) for c in v['changes'] if c['kind'] in ('rename', 'remove', 'add', 'other')]
    out = [c for c in out if all(norm(c[k]) in norm(answer) for k in ('frm', 'to') if c[k])]   # quote must exist in the answer
    return out, None

def slot_claims(text, summary):
    p = ('JSON 으로만 답하라. 아래 [최종 메시지/노트]가 최종 도식 파일(F)에 대해 한, 도식 모습에 관한 주장만 뽑아라. 검사 통과·절차·내부 파일 얘기, 다른 단계(L0 등) 그림 얘기, 시험 못 했다는 말은 제외.\n'
         '허용 type 과 필드: interaction{trigger:hover|click}, label_present{label}, shape{label,shape:stadium|rect}, region{label}, count{what:nodes|regions|edges,n}, '
         'uncertain_marked{}, no_fill{}, arrowheads{}, palette{} (색을 5색/흑색만 썼다는 주장). 나머지는 other{}. quote 는 [최종 메시지/노트]에서 글자 그대로.\n'
         '[도식 요약] %s\n[최종 메시지/노트]\n%s\n출력: {"claims":[{"type":"shape","label":"주문","shape":"stadium","quote":"..."}]}  (없으면 빈 배열)' % (summary, text))
    def key(c): return (c.get('type'), norm(str(c.get('label', ''))) , c.get('trigger'), c.get('shape'), c.get('what'), str(c.get('n')))
    fn = getattr(_tl, 'fn', None) or llm
    with ThreadPoolExecutor(1 if SEQ else 2) as ex: r = list(ex.map(lambda _: fn(p), range(2)))
    if any(x is None for x in r): return None, None, 'H-LLM'
    ntext = re.sub(r'\s+', '', text)
    try:
        fills = [[c for c in j['claims'] if c.get('type') != 'other' and re.sub(r'\s+', '', str(c.get('quote', ''))) in ntext] for j in r]
        sets = [{key(c) for c in f} for f in fills]
    except Exception: return None, None, 'H-SLOT'
    # compare the two fills as normalised sets per claim; only claims present in one fill but not the other are in dispute
    seen, allc, dis = set(), [], []
    for f in fills:
        for c in f:
            k = key(c)
            if k in seen: continue
            seen.add(k); allc.append(c)
            if not (k in sets[0] and k in sets[1]): dis.append(c)
    return allc, dis, None

# ================= run loading & picture selection =================
RENDER = ('.svg', '.html', '.png')
SKIP_DIRS = {'.claude', 'node_modules', '__pycache__'}
class Pic:
    def __init__(s, key, files, turn): s.key, s.files, s.turn, s._x, s._a = key, files, turn, None, None
    def extract_file(s, prefer_html):
        order = ('.html', '.svg') if prefer_html else ('.svg', '.html')
        return next((s.files[e] for e in order if e in s.files), None)
    def content_hash(s, prefer_html):
        f = s.extract_file(prefer_html) or next(iter(s.files.values()))
        return hashlib.sha1(open(f, 'rb').read()).hexdigest()

class Ctx:
    def __init__(s, run_dir):
        s.dir = os.path.abspath(run_dir); s.warn = []; s.items = {}; s.holds = []
        s.run = json.load(open(os.path.join(s.dir, 'run.json'), encoding='utf-8'))
        s.case = s.run['case']; s.facts = FACTS[s.case]
        tasks = json.load(open(os.path.join(HERE, 'gc_tasks_human_rewrite.json'), encoding='utf-8'))
        s.request = s.run.get('request') or next(c['query'] for c in tasks['cases'] if c['id'] == s.case)
        s.prereg = json.load(open(os.path.join(HERE, 'prereg', s.case + '.json'), encoding='utf-8'))
        s.turns = s.run['turns']; s.T = len(s.turns); s.cache = {}
        s.text = {t['turn']: t.get('output', '') for t in s.turns}
        s.need_html = s.facts['html']
        s.noevid = [t['turn'] for t in s.turns if not os.path.exists(os.path.join(s.dir, 'turn%d.jsonl' % t['turn']))]
    # -- files
    def all_render_files(s):
        out = []
        for r, ds, fs in os.walk(s.dir):
            ds[:] = [d for d in ds if d not in SKIP_DIRS]
            for f in fs:
                p = os.path.join(r, f)
                if f.lower().endswith(RENDER) and not (r == s.dir and f == 'index.html'): out.append(p)
        return out
    def resolve(s, token):
        token = token.strip('`\'"()[]<>,.;:')
        rid = s.run['run_id']
        if rid in token: token = token.split(rid + '/', 1)[-1]
        cands = [os.path.join(s.dir, token.lstrip('/')), token]
        for c in cands:
            if os.path.isfile(c) and os.path.abspath(c).startswith(s.dir): return os.path.abspath(c)
        suf = '/'.join(token.strip('/').split('/')[-3:])
        hits = [f for f in s.all_render_files() if f.endswith('/' + suf) or f.endswith(suf)]
        return hits[0] if len(hits) == 1 else (sorted(hits, key=len)[0] if hits else None)
    def groups_in(s, text, turn):
        found = {}
        for tok in re.findall(r'[\w\-./~]+\.(?:svg|html|png)\b', text, re.I):
            f = s.resolve(tok)
            if f and f.lower().endswith(RENDER): found.setdefault(os.path.splitext(f)[0], f)
        out = []
        for stem in found:                      # a group = all variants sharing dir+stem
            files = {e: stem + e for e in RENDER if os.path.isfile(stem + e)}
            out.append(Pic(stem, files, turn))
        return out
    def build(s):
        s.pics = {t['turn']: s.groups_in(s.text[t['turn']], t['turn']) for t in s.turns}
        s.F, s.f_why, s.f_hold = None, '', None
        last = s.pics.get(s.T, [])
        ph = s.need_html
        if last:
            earlier = {p.key for t in range(1, s.T) for p in s.pics.get(t, [])}
            cand = [p for p in last if p.key not in earlier] or last
            if len(cand) > 1 and ph: cand = [p for p in cand if '.html' in p.files] or cand
            if len({p.content_hash(ph) for p in cand}) > 1: s.f_hold = 'H-AMBIG'; s.f_why = 'final message names %d different pictures: %s' % (len(cand), [os.path.basename(p.key) for p in cand])
            else: s.F = cand[-1]; s.f_why = 'named in final message (turn %d)%s' % (s.T, '; excluded %d already shown earlier' % (len(last) - len(cand)) if len(cand) < len(last) else '')
        else:
            files = s.all_render_files(); stems = {}
            for f in files: stems.setdefault(os.path.splitext(f)[0], {})[os.path.splitext(f)[1].lower()] = f
            pics = [Pic(k, v, s.T) for k, v in stems.items()]
            if ph and any('.html' in p.files for p in pics): pics = [p for p in pics if '.html' in p.files]
            if pics:
                if len({p.content_hash(ph) for p in pics}) > 1: s.f_hold = 'H-AMBIG'; s.f_why = 'no file named in final message; %d candidates with different content' % len(pics)
                else:
                    s.F = max(pics, key=lambda p: max(os.path.getmtime(f) for f in p.files.values())); s.f_why = 'no file named in final message; same-content candidates, newest mtime'
            else: s.f_why = 'no renderable file in run dir'
        return s
    # -- extraction
    def X(s, pic):
        if pic._a is None:
            html = s.need_html
            f = pic.extract_file(html)
            if f is None: raise RenderError('only %s available, cannot extract' % ','.join(pic.files))
            if f not in s.cache: s.cache[f] = analyze(chrome_extract(f) if f.endswith('.html') else extract_svg(f))
            pic._a = s.cache[f]; pic._f = f
        return pic._a
    # -- answers
    def ans(s, t):
        r = s.turns[t - 1]; return r.get('answer')
    def topic(s, t):
        r = s.turns[t - 1]; return r.get('answer_topic') or (r.get('classifier') or {}).get('topic')
    def questions(s, t):
        k = ('q', t)
        if k not in s.cache: s.cache[k] = slot_questions(s.text[t])
        return s.cache[k]
    def feedback(s, t):
        k = ('fb', t)
        if k not in s.cache: s.cache[k] = slot_feedback(s.ans(t))
        return s.cache[k]
    def item(s, code, verdict, evidence, reason=None, warn=()):
        it = dict(code=code, verdict=verdict, evidence=evidence)
        if reason: it['reason_code'] = reason
        if warn: it['warnings'] = list(warn); s.warn += ['%s:%s' % (code, w) for w in warn]
        s.items[code] = it
        if verdict == 'HOLD': s.holds.append(reason)

# ================= matching required labels to the picture =================
def match_labels(c, a, required):
    """required: list of request labels. -> (map req->element, unresolved(list of req with slot disagreement))"""
    els = a['nodes'] + a['regions']; byn = {}
    if not hasattr(c, 'slot_why'): c.slot_why = {}
    for e in els: byn.setdefault(norm(e['label']), e)
    m, unresolved, used = {}, [], set()
    for r in required:
        if norm(r) in byn: m[r] = byn[norm(r)]; used.add(norm(r))
    req_norms = {norm(r) for r in required}
    for r in [r for r in required if r not in m]:
        cands = [e for e in els if norm(e['label']) not in req_norms and norm(e['label']) not in used]
        cands = sorted(cands, key=lambda e: -difflib.SequenceMatcher(None, norm(r), norm(e['label'])).ratio())
        cands = [e for e in cands if difflib.SequenceMatcher(None, norm(r), norm(e['label'])).ratio() >= 0.4][:3]
        # deterministic pre-match: normalised request label is a contiguous substring of exactly one candidate picture label -> same (no LLM call)
        sub = [e for e in els if norm(e['label']) not in req_norms and norm(e['label']) not in used and norm(r) and norm(r) in norm(e['label'])]
        if len(sub) == 1: m[r] = sub[0]; used.add(norm(sub[0]['label'])); continue
        for e in cands:
            v, why = slot_alias(r, e['label'])
            if why: unresolved.append(r); c.slot_why[r] = why; break
            if v == 'same': m[r] = e; used.add(norm(e['label'])); break
    return m, unresolved

# ================= items =================
def required_labels(c):
    """request labels, with Human-requested renames applied (feedback slot)."""
    labs = list(c.facts['labels']); ren = {}
    for t in range(1, c.T + 1):
        if c.ans(t) and c.turns[t - 1].get('classifier', {}).get('asks_human'):
            fb, why = c.feedback(t)
            if fb:
                for ch in fb:
                    if ch['kind'] == 'rename':
                        for l in labs:
                            if norm(l) == norm(ch['frm']): ren[l] = ch['to']
    return labs, ren

def run_judge(run_dir, llm_fn=None):
    _tl.fn = llm_fn
    c = Ctx(run_dir).build()
    f = c.facts
    # ---------- V0 ----------
    topics_ok = set(c.prereg['answers_by_topic']) - {'fallback'}
    bad = []
    for t in c.turns:
        cl = t.get('classifier') or {}
        if t.get('answer') is not None and not cl.get('asks_human'): bad.append('turn %d: answer without question' % t['turn'])
        if t.get('proxy_fallback'): bad.append('turn %d: proxy_fallback' % t['turn'])
        if t.get('answer') is not None and (c.topic(t['turn']) not in topics_ok): bad.append('turn %d: topic %r not in prereg' % (t['turn'], c.topic(t['turn'])))
    if c.T >= 6 and (c.turns[-1].get('classifier') or {}).get('asks_human'): bad.append('6-turn cap reached')
    if bad: c.item('V0', 'HOLD', '; '.join(bad), 'H-PROXY')
    else: c.item('V0', 'PASS', 'answers=%d, all topics in prereg' % sum(1 for t in c.turns if t.get('answer') is not None))
    if c.noevid: c.item('E1', 'HOLD', 'missing transcript for turn(s) %s' % c.noevid, 'H-NOEVID')
    # ---------- picture ----------
    A = None; xerr = None
    if c.F is not None:
        try: A = c.X(c.F)
        except RenderError as e: xerr = str(e)
    def need(code):
        """-> a, or records HOLD/FAIL on item and returns None."""
        if c.f_hold: c.item(code, 'HOLD', c.f_why, c.f_hold); return None
        if c.F is None: c.item(code, 'FAIL', c.f_why); return None
        if A is None: c.item(code, 'HOLD', 'cannot extract %s: %s' % (os.path.basename(c.F.key), xerr), 'H-RENDER' if code == 'J1' else 'H-EXTRACT'); return None
        return A
    # J1
    if c.f_hold: c.item('J1', 'HOLD', c.f_why, c.f_hold)
    elif c.F is None: c.item('J1', 'FAIL', c.f_why)
    else:
        ev = 'F=%s (%s); extract=%s' % (os.path.relpath(c.F.key, c.dir), c.f_why, os.path.basename(c.F.extract_file(c.need_html) or '?'))
        if c.need_html and '.html' not in c.F.files: c.item('J1', 'FAIL', ev + '; task requires HTML but F has only ' + ','.join(c.F.files))
        elif A is None: c.item('J1', 'HOLD' if 'cannot extract' not in (xerr or '') else 'FAIL', ev + '; ' + str(xerr), 'H-RENDER')
        elif not A['raw']['texts']: c.item('J1', 'FAIL', ev + '; no visible text after render')
        else: c.item('J1', 'PASS', ev + '; visible text nodes=%d' % len(A['raw']['texts']), warn=(['W-CONSOLE-ERR'] if A['raw'].get('errs') else []))
    # ---------- shared computations ----------
    labs, ren = required_labels(c)
    req = [ren.get(l, l) for l in labs]; back = {ren.get(l, l): l for l in labs}   # picture-side name -> canonical label
    a = need('J2') if False else (A if (A and not c.f_hold) else None)
    mp, unres = ({}, [])
    if a: mp, unres = match_labels(c, a, req)
    canon_of = {id(e): back[r] for r, e in mp.items()}
    missing = [r for r in req if r not in mp and r not in unres]
    # J8 first (J2 and J3 reuse it)
    dev = j8(c, A, req, mp, missing, a)
    # J2
    if not a: need('J2')
    else:
        probe = set(norm(t) for t in a['raw'].get('texts_probe', []))
        revealed = [r for r in missing if norm(r) in probe]
        miss = [r for r in missing if r not in revealed]
        excused = [r for r in miss if dev.get(('miss', r)) in ('PASS',)]
        if unres: c.item('J2', 'HOLD', 'alias slot unresolved for %s' % unres, 'H-LLM' if any(c.slot_why.get(r) == 'H-LLM' for r in unres) else 'H-SLOT')
        elif [r for r in miss if r not in excused]: c.item('J2', 'FAIL', 'required labels not visible: %s' % [r for r in miss if r not in excused])
        else: c.item('J2', 'PASS', 'all %d required labels visible%s%s' % (len(req) - len(miss) - len(revealed), '; revealed by interaction: %s' % revealed if revealed else '', '; Human-decided omission: %s' % excused if excused else ''))
        a['_excused'] = set(excused) | set(revealed)
    j3(c, a, req, mp, canon_of, unres, need)
    j4(c, a, need); j5(c, a, mp, canon_of, need); j6(c, a, need); j7(c, a, mp, need)
    c.rs = rs_records(c, a) if (a and not c.f_hold) else []
    c.items['J8'] = dev['item']; 
    if dev['item']['verdict'] == 'HOLD': c.holds.append(dev['item'].get('reason_code'))
    j9(c); j10(c, a, need, ren, dev.get('n_decisions')); j11(c, a, need); j12(c, a, need, ren); j13(c)
    order = ['V0', 'E1', 'J1', 'J2', 'J3', 'J4', 'J5', 'J6', 'J7', 'J8', 'J9', 'J10', 'J11', 'J12', 'J13']
    items = [c.items[k] for k in order if k in c.items]
    vs = [i['verdict'] for i in items]
    if 'FAIL' in vs: v = 'FAIL'
    elif all(x in ('PASS', 'NA') for x in vs): v = 'PASS'
    else: v = 'HOLD'
    out = dict(run_id=c.run['run_id'], verdict=v, items=items, warnings=c.warn, rs=c.rs)
    if v == 'HOLD': out['hold_codes'] = sorted({h for h in c.holds if h})
    if c.items['V0']['verdict'] == 'HOLD': out['v0_flag'] = 'run validity doubtful (H-PROXY); J items still scored'
    json.dump(out, open(os.path.join(c.dir, 'judge.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return out

def j3(c, a, req, mp, canon_of, unres, need):
    if not need('J3') and True:
        if not a: return
    f = c.facts
    if not a['nodes']: return c.item('J3', 'HOLD', 'labels present but no node shapes found', 'H-EXTRACT') if a['raw']['texts'] else c.item('J3', 'FAIL', 'empty picture')
    ren_back = {r: l for l in f['labels'] for r in [l]}
    # picture-element canonical label (required-label id, i.e. original request label)
    def cid(e): return canon_of.get(id(e))
    rename = {v: k for k, v in zip(req, f['labels'])}   # canonical->picture-name
    def cov(x):
        els = set()
        for e in a['nodes'] + a['regions']:
            if cid(e) == x: els.add(id(e))
        for r in a['regions']:
            if cid(r) == x: els |= {id(n) for n in r['children']}
            if any(cid(n) == x for n in r['children']): els.add(id(r))
        return els
    excused = a.get('_excused', set())
    # canonical required-label names are the original request labels in f['edges']
    bad_missing = []
    for u, v in f['edges']:
        if any(rename.get(z, z) in excused for z in (u, v)): continue
        cu, cv = cov(u), cov(v)
        if not any(id(e['src']) in cu and id(e['dst']) in cv for e in a['edges'] if e['src'] is not None and e['dst'] is not None): bad_missing.append('%s->%s' % (u, v))
    # reverse / lateral
    rank, branch, rev = f['rank'], f['branch'], []
    def labels_of(e):
        if e is None: return []
        if id(e) in [id(r) for r in a['regions']]: return [cid(e)] + [cid(n) for n in e['children']] if cid(e) else [cid(n) for n in e['children']]
        return [cid(e)]
    for e in a['edges']:
        U, V = [x for x in labels_of(e['src']) if x], [x for x in labels_of(e['dst']) if x]
        if any(rank[u] > rank[v] for u in U for v in V if u in rank and v in rank and not (branch.get(u) and branch.get(v) and branch[u] != branch[v])): rev.append('%s->%s' % (U, V))
        for u in U:
            for v in V:
                if u != v and branch.get(u) and branch.get(v) and (branch[u] != branch[v] if not f.get('branch_nolateral') else branch[u] == branch[v]): rev.append('lateral %s->%s' % (u, v))
    unattr = sum(1 for e in a['edges'] if e['src'] is None or e['dst'] is None)
    if unres and bad_missing: return c.item('J3', 'HOLD', 'alias slot unresolved for %s' % unres, 'H-LLM' if any(getattr(c, 'slot_why', {}).get(r) == 'H-LLM' for r in unres) else 'H-SLOT')
    if rev: return c.item('J3', 'FAIL', 'reverse/forbidden edges: %s' % rev[:4])
    if bad_missing:
        if unattr: return c.item('J3', 'HOLD', 'required edges missing %s but %d edge ends could not be attributed to a node' % (bad_missing[:4], unattr), 'H-EXTRACT')
        return c.item('J3', 'FAIL', 'required edges missing: %s' % bad_missing[:6])
    c.item('J3', 'PASS', 'all %d required edges present, 0 reverse' % len(f['edges']))

def j4(c, a, need):
    if not need('J4'): return
    bad, warn = [], []
    for n, e in enumerate(a['edges']):
        nm = '%s->%s' % (e['src']['label'] if e['src'] else '?', e['dst']['label'] if e['dst'] else '?')
        if not e['marker']: bad.append('no arrowhead ' + nm)       # dash is not a verdict ground (DEC-146); see RS (c)
        if e['curve']: warn.append('W-CURVE')
    if not a['edges']: return c.item('J4', 'HOLD', 'no edges extracted', 'H-EXTRACT')
    if bad: return c.item('J4', 'FAIL', '; '.join(bad[:4]), warn=sorted(set(warn)))
    c.item('J4', 'PASS', '%d edges, all with arrowhead' % len(a['edges']), warn=sorted(set(warn)))

def j5(c, a, mp, canon_of, need):
    if not need('J5'): return
    f = c.facts; shapes = {}
    for r, e in mp.items():
        l = canon_of[id(e)]
        if e in a['regions']: continue
        role = 'P' if l in f['P'] else 'E' if l in f['E'] else None
        if role: shapes.setdefault(role, {})[l] = e['shape']
    badP = [l for l, s in shapes.get('P', {}).items() if s == 'stadium']
    es = set(shapes.get('E', {}).values())
    if badP: return c.item('J5', 'FAIL', 'Process as stadium: %s' % badP)
    if len(es) > 1: return c.item('J5', 'FAIL', 'Entity shapes mixed: %s' % shapes['E'])
    if es - {'rect', 'stadium'}: return c.item('J5', 'FAIL', 'Entity shape not rect/stadium: %s' % shapes['E'])
    c.item('J5', 'PASS', 'P shapes=%s E shapes=%s' % (sorted(set(shapes.get('P', {}).values())), sorted(es)))

def j6(c, a, need):
    if not need('J6'): return
    bgs, bad, warn = a['bgs'], [], []
    if not a['nodes']: return c.item('J6', 'HOLD', 'no nodes extracted', 'H-EXTRACT')
    for n in a['nodes']:
        fc = col(n['fill'])
        if not is_bg(fc, bgs): bad.append('node %r filled %s' % (n['label'], hexs(fc)))
    for r in a['regions']:
        if not is_bg(col(r['fill']), bgs): warn.append('W-REGIONFILL')
    cols = [(s['label'], 'stroke', col(s['stroke'])) for s in a['nodes'] + a['regions']] + [(s['label'], 'fill', col(s['fill'])) for s in a['nodes'] + a['regions']] + \
           [(e['src']['label'] if e['src'] else '?', 'edge', col(e['stroke'])) for e in a['edges']] + [(t['t'], 'text', col(t['fill'])) for t in a['texts']]
    for who, kind, cc in cols:
        if not palette_ok(cc): bad.append('%s %s %s outside 5 colours' % (who, kind, hexs(cc)))
    c.item('J6', 'FAIL' if bad else 'PASS', '; '.join(bad[:4]) if bad else 'no node fill, palette ok', warn=sorted(set(warn)))

def rs_records(c, a):
    """Source record RS (DEC-146/147). RECORD ONLY: never read by any verdict. Per region / dashed edge: (a) source existence, (b) source_undecided (2 fills), (c) `2 6` dash present."""
    att, names = '', []
    for sub in ('attachments', 'source', 'sources'):
        d = os.path.join(c.dir, sub)
        if os.path.isdir(d):
            names.append(sub + '/')
            for r, _, fs in os.walk(d):
                for f in sorted(fs): names.append(f); att += open(os.path.join(r, f), encoding='utf-8', errors='replace').read() + '\n'
    m = SRC_REF.search(c.request or '')
    if not (c.request or '').strip() and not att.strip(): src_a = '존재하지 않음'
    elif att.strip(): src_a = ', '.join(names)
    elif m: src_a = '확정 불가: ' + m.group(0).strip()
    else: src_a = '과제 요청문'
    elems = [('region', r['label'], r['dash']) for r in a['regions']] + \
            [('edge', '%s -> %s' % (e['src']['label'] if e['src'] else '?', e['dst']['label'] if e['dst'] else '?'), e['dash']) for e in a['edges'] if is_dash26(e['dash'])]
    und = {}
    if elems and not src_a.startswith(('존재하지', '확정 불가')):
        und, why = slot_source_undecided(c.request + '\n' + att, [('e%d' % i, ('묶음(region) ' if k == 'region' else '간선 ') + l) for i, (k, l, _) in enumerate(elems)])
        if why: und = {'e%d' % i: why for i in range(len(elems))}
    return [dict(kind=k, label=l, source=src_a, source_undecided=und.get('e%d' % i, 'N/A') if und else 'N/A', dash26=is_dash26(d)) for i, (k, l, d) in enumerate(elems)]

def is_dash26(d):
    return [float(x) for x in re.findall(r'[\d.]+', d or '')] [:2] == [2.0, 6.0]

def j7(c, a, mp, need):
    if not need('J7'): return
    f = c.facts; bad = []
    # J7 (2026-10-06, DEC-146): no source<->picture comparison; dash is recorded in RS only.
    for r in a['regions']:
        if r['own_texts'] != 1: bad.append('region %r has %d texts (must be label only)' % (r['label'], r['own_texts']))
    wp = f['whole_part']
    if wp:
        whole, parts = wp; reg = next((r for r in a['regions'] if norm(r['label']) == norm(whole) or norm(whole) in norm(r['label'])), None)
        have = [p for p in parts if norm(p) in a['text_set']]
        if reg is None:
            probe = {norm(t) for t in a['raw'].get('texts_probe', [])}
            if len(have) == len(parts) and True: bad.append('whole_part %s⊃%s drawn without containment (no region, no folded node)' % (whole, parts))
            elif not all(norm(p) in probe for p in parts): bad.append('whole_part parts not visible nor revealed by interaction')
        else:
            inside_p = [n for n in reg['children'] if norm(n['label']) in {norm(p) for p in parts}]
            if len(inside_p) < len(parts): bad.append('region %r does not contain %s' % (reg['label'], parts))
    if bad: return c.item('J7', 'FAIL', '; '.join(bad[:4]))
    c.item('J7', 'PASS', '%d region(s), label only (border style recorded in RS)' % len(a['regions']) if a['regions'] else 'no region needed / folded and revealed')

# ---- J8 ----
def j8(c, A, req, mp, missing, a):
    """-> dict with 'item' and ('miss', label)->verdict entries."""
    res = {}
    if c.f_hold or c.F is None or A is None:
        res['item'] = dict(code='J8', verdict='HOLD' if c.f_hold else 'FAIL', evidence=c.f_why or 'no picture', **({'reason_code': c.f_hold or 'H-EXTRACT'} if c.f_hold or A is None and c.F is not None else {}))
        if c.F is not None and A is None and not c.f_hold: res['item']['verdict'] = 'HOLD'; res['item']['reason_code'] = 'H-EXTRACT'
        return res
    pics = [(t, p) for t in range(1, c.T + 1) for p in c.pics.get(t, []) if p.key != c.F.key] + [(c.T, c.F)]
    devs = {}   # (kind, normquote) -> dict(first_turn, texts, label)
    req_norms = {norm(r) for r in req}
    for t, p in pics:
        try: ap = c.X(p)
        except RenderError: c.warn.append('J8:S_k %s not extractable' % os.path.basename(p.key)); continue
        mp2 = mp if p is c.F else {r: e for r, e in match_labels(c, ap, req)[0].items()}
        matched = {norm(e['label']) for e in mp2.values()}
        cands = [e['label'] for e in ap['regions'] if norm(e['label']) not in req_norms] + [e['label'] for e in ap['nodes'] if norm(e['label']) not in req_norms and norm(e['label']) not in matched]
        if not cands: continue
        reg = {r['label']: [n['label'] for n in r['children']] for r in ap['regions']}
        v, why, ok = slot_deviations(c.request, [e['label'] for e in ap['nodes']], reg, cands)
        if why: res['item'] = dict(code='J8', verdict='HOLD', evidence='deviations slot disagreed for picture %s' % os.path.basename(p.key), reason_code=why); return res
        for kind, q in v:
            d = devs.setdefault((kind, q), dict(first=t, label=ok[q], pic=p, ap=ap))
            d['first'] = min(d['first'], t)
    miss_items = {}
    out, bad = [], []
    final_text = c.text[c.T]
    for (kind, q), d in sorted(devs.items(), key=lambda kv: str(kv[0])):
        verdict, why = j8_decide(c, kind, d, final_text)
        if verdict == 'HOLD': res['item'] = dict(code='J8', verdict='HOLD', evidence=why, reason_code=c._j8hold); return res
        out.append('%s kind%d %r -> %s (%s)' % ('F' if d['pic'] is c.F else 'S', kind, d['label'], verdict, why)); 
        if verdict == 'FAIL': bad.append(out[-1])
    # omissions (kind 2): required label missing from F and not revealed
    probe = {norm(t) for t in A['raw'].get('texts_probe', [])}
    for r in missing:
        if norm(r) in probe: continue
        d = dict(first=c.T, label=r, pic=c.F, ap=A)
        verdict, why = j8_decide(c, 2, d, final_text)
        if verdict == 'HOLD': res['item'] = dict(code='J8', verdict='HOLD', evidence=why, reason_code=c._j8hold); return res
        miss_items[('miss', r)] = verdict
        out.append('F kind2 omit %r -> %s (%s)' % (r, verdict, why))
        if verdict == 'FAIL': bad.append(out[-1])
    res.update(miss_items)
    res['n_decisions'] = len(devs) + len(miss_items)
    res['item'] = dict(code='J8', verdict='FAIL' if bad else 'PASS', evidence='; '.join(bad[:4]) if bad else ('; '.join(out) if out else 'no structure decisions beyond the request'))
    return res

def j8_decide(c, kind, d, final_text):
    ans = []
    for t in range(1, c.T + 1):
        if c.ans(t) is None: continue
        qs, why = c.questions(t) if (c.turns[t - 1].get('classifier') or {}).get('asks_human') else ([], None)
        topics = {c.topic(t)} | {q[0] for q in (qs or [])}
        if topics & DEV_TOPICS[kind]: ans.append((t, c.ans(t)))
    base = None
    if kind == 2 and d['pic'] is c.F and not ans: base = ('FAIL', 'omitted in F, no Human decision')
    elif not ans: base = ('FAIL', 'no question answered, review pending not stated in text')
    else:
        t, text = ans[0]
        if '판단에 맡' in text: return 'PASS', '(b) DELEGATED at turn %d' % t
        if d['first'] <= t and kind != 2: base = ('FAIL', 'structure first shown in turn %d, not later than Human answer in turn %d, message does not state Agent decision / review pending' % (d['first'], t))
        else: return 'PASS', '(a) Human answered at turn %d: %r' % (t, text[:30])
    # (c) (2026-10-06): slot review_notice on the message that showed the structure (final message for F-only structures); no keyword regex
    shown_turn = d['first'] if d['first'] < c.T else c.T
    shown_msg = c.text.get(shown_turn, '') if d['first'] < c.T else final_text
    k = ('rn', shown_turn, norm(d['label']))
    if k not in c.cache: c.cache[k] = slot_review_notice(shown_msg, d['label'])
    v, why = c.cache[k]
    if why: c._j8hold = why; return 'HOLD', 'review_notice slot %s for %r (turn %d)' % ('LLM call failed' if why == 'H-LLM' else 'fills disagree', d['label'], shown_turn)
    if v == 'yes': return 'PASS', '(c) review_notice yes 2/2 in message of turn %d' % shown_turn
    return base

def j9(c):
    qturns = [t for t in range(1, c.T + 1) if (c.turns[t - 1].get('classifier') or {}).get('asks_human')]
    if not qturns: return c.item('J9', 'PASS', 'no question was asked')
    ev, warn, bad = [], [], []
    for t in qturns:
        qs, why = c.questions(t)
        if why: return c.item('J9', 'HOLD', 'questions slot disagreement at turn %d' % t, why)
        for topic, decided in qs:
            ev.append('t%d:%s%s' % (t, topic, '(decided)' if decided else ''))
            if topic in c.facts['redundant_topics']: warn.append('W-REDUNDANT')
            if decided and topic not in c.facts['redundant_topics']: bad.append('turn %d states a structure as already decided (topic %s)' % (t, topic))
    c.item('J9', 'FAIL' if bad else 'PASS', '; '.join(bad) if bad else ', '.join(ev) or 'no question found in messages', warn=sorted(set(warn)))

def j10(c, a, need, ren, ndec=None):
    if c.f_hold: return c.item('J10', 'HOLD', c.f_why, c.f_hold)
    # Human decision DEC-109: J10 is NA when nothing needed a Human decision (no J8 structural decision requiring the Human and no decision question asked by the agent)
    if ndec == 0 and not any((t.get('classifier') or {}).get('asks_human') for t in c.turns): return c.item('J10', 'NA', 'no Human decision was needed (no J8 structural decision, no question asked) (DEC-109)')
    shown = [(t, p) for t in range(1, c.T) for p in c.pics.get(t, [])]
    if not shown: return c.item('J10', 'FAIL', 'no picture was shown to Human before the final turn (1)')
    t1, p1 = shown[0]
    if not (c.turns[t1 - 1].get('classifier') or {}).get('asks_human') or c.ans(t1) is None: return c.item('J10', 'FAIL', 'no Human feedback after S_1 (turn %d) (3)' % t1)
    if not a: return need('J10')
    try: a1 = c.X(p1)
    except RenderError as e: return c.item('J10', 'HOLD', 'S_1 not extractable: %s' % e, 'H-RENDER')
    n1, nf = len(a1['nodes']), len(a['nodes'])
    if n1 > nf: return c.item('J10', 'FAIL', 'S_1 has more nodes (%d) than F (%d) (2)' % (n1, nf))
    if a['regions'] and (a1['regions'] or n1 >= nf): return c.item('J10', 'FAIL', 'F has region(s) %s but S_1 does not fold them (S_1 nodes=%d regions=%d, F nodes=%d) (2)' % ([r['label'] for r in a['regions']], n1, len(a1['regions']), nf))
    fb, why = c.feedback(t1)
    if why: return c.item('J10', 'HOLD', 'feedback_changes slot disagreement', why)
    bad = []
    flabs = a['labels']
    for ch in fb:
        if ch['kind'] == 'rename' and (norm(ch['to']) not in flabs or norm(ch['frm']) in flabs): bad.append('rename %r->%r not reflected' % (ch['frm'], ch['to']))
        if ch['kind'] == 'remove' and norm(ch['frm']) in flabs: bad.append('remove %r not reflected' % ch['frm'])
        if ch['kind'] == 'add' and norm(ch['to']) not in flabs: bad.append('add %r not reflected' % ch['to'])
    warn = ['W-FEEDBACK-UNVERIFIABLE'] if any(ch['kind'] == 'other' for ch in fb) else []
    c.item('J10', 'FAIL' if bad else 'PASS', ('; '.join(bad) + ' (4)') if bad else 'S_1 turn %d: nodes %d<=%d%s, feedback %s' % (t1, n1, nf, ', folds regions' if a['regions'] else '', 'changes applied' if fb else 'approval only'), warn=warn)

def j11(c, a, need):
    if not need('J11'): return
    notes = ''
    for r, ds, fs in os.walk(c.dir):
        ds[:] = [d for d in ds if d not in SKIP_DIRS]
        notes += ''.join(open(os.path.join(r, x), encoding='utf-8', errors='replace').read() + '\n' for x in fs if 'notes' in x.lower() and x.endswith('.md'))
    text = c.text[c.T] + '\n' + notes
    summ = dict(nodes=[(n['label'], n['shape']) for n in a['nodes']], regions=[r['label'] for r in a['regions']], edges=len(a['edges']))
    cl, dis, why = slot_claims(text, json.dumps(summ, ensure_ascii=False))
    if why: return c.item('J11', 'HOLD', 'claims slot disagreement' if why == 'H-SLOT' else 'claims slot LLM call failed', why)
    dis_ids = {id(x) for x in dis}; bad_dis = []
    bad, ok, warn, raw = [], 0, [], a['raw']
    labs = a['labels']
    for k in cl:
        t = k.get('type'); L = norm(str(k.get('label', ''))); res = None
        if t == 'interaction':
            tr = k.get('trigger')
            res = bool(raw.get('hover_rules') or raw.get('hover_changed')) if tr == 'hover' else bool(raw.get('click_changed'))   # observed effect, not mere handler presence
        elif t == 'label_present': res = any(L and (L in x or x in L) for x in labs)
        elif t == 'shape': res = any(norm(n['label']) == L and n['shape'] == k.get('shape') for n in a['nodes'])
        elif t == 'region': res = any(L and (L in norm(r['label']) or norm(r['label']) in L) for r in a['regions'])
        elif t == 'count':
            try: res = {'nodes': len(a['nodes']), 'regions': len(a['regions']), 'edges': len(a['edges'])}[k.get('what')] == int(k.get('n'))
            except Exception: res = None
        elif t == 'uncertain_marked': res = any(MARK.search(x['t']) for x in a['texts']) or any(dashed(e['dash']) for e in a['edges'])
        elif t == 'no_fill': res = all(is_bg(col(n['fill']), a['bgs']) for n in a['nodes'])
        elif t == 'arrowheads': res = all(e['marker'] for e in a['edges'])
        elif t == 'palette': res = all(palette_ok(col(x['stroke'])) for x in a['nodes'] + a['regions'])
        if res is None: warn.append('W-CLAIM-UNVERIFIABLE'); continue
        if res: ok += 1
        elif id(k) in dis_ids: bad_dis.append('%s claim false: %r' % (t, str(k.get('quote'))[:50]))
        else: bad.append('%s claim false: %r' % (t, str(k.get('quote'))[:50]))
    if not bad and bad_dis: return c.item('J11', 'HOLD', 'claims fills disagree on claim(s) that would change the verdict: %s' % '; '.join(bad_dis[:3]), 'H-SLOT')
    c.item('J11', 'FAIL' if bad else 'PASS', '; '.join(bad[:4]) if bad else '%d claim(s) verified' % ok, warn=sorted(set(warn)))

def j12(c, a, need, ren):
    if c.f_hold: return c.item('J12', 'HOLD', c.f_why, c.f_hold)
    prev = [(t, p) for t in range(1, c.T) for p in c.pics.get(t, []) if c.ans(t) is not None]
    if not prev: return c.item('J12', 'NA', 'no picture was approved by Human before F')
    if not a: return need('J12')
    t = prev[-1][0]; removed = {norm(x) for x in ren} | set()
    fb, why = c.feedback(t)
    if why: return c.item('J12', 'HOLD', 'feedback_changes slot disagreement', why)
    for ch in fb:
        if ch['kind'] in ('rename', 'remove'): removed.add(norm(ch['frm']))
    labels = set()
    for tt, p in [x for x in prev if x[0] == t]:
        try: ap = c.X(p)
        except RenderError as e: return c.item('J12', 'HOLD', 'S_k not extractable: %s' % e, 'H-RENDER')
        labels |= set(ap['labels'])
    gone = [l for l in labels if l not in set(a['labels']) and l not in removed and not any(l in x or x in l for x in a['labels'] if len(l) > 1 and False)]
    c.item('J12', 'FAIL' if gone else 'PASS', 'labels dropped after approval (turn %d): %s' % (t, gone[:5]) if gone else 'S_k(turn %d) labels (%d) all kept in F' % (t, len(labels)))

def _tables(text):
    out, cur = [], []
    for ln in text.split('\n') + ['']:
        if ln.strip().startswith('|'): cur.append([x.strip() for x in ln.strip().strip('|').split('|')])
        else:
            if len(cur) >= 2: out.append(cur)
            cur = []
    return out
def j13(c):
    tabs = _tables(c.text[c.T]); sem = None
    for t in tabs:
        h = ' '.join(t[0])
        if '같은 뜻' in h or '같은뜻' in h or '대조' in h or ('원천' in h and ('이미지' in h or '렌더' in h)): sem = t; break
    rows = [r for r in (sem or [[]])[1:] if not all(re.fullmatch(r':?-{2,}:?', x.replace(' ', '')) or not x for x in r)]
    if sem is None or not rows: return c.item('J13', 'PASS', 'no semantic-consistency table in the final message (not a FAIL, DEC-142)', warn=['W-NOSEMTABLE'])
    hdr = sem[0]; basis, hold = [], None
    for r in rows:
        rt = ' | '.join('%s: %s' % (hdr[i] if i < len(hdr) else '', x) for i, x in enumerate(r))
        b, why = slot_row_basis(rt)      # slot row_basis, 2 independent fills; the verdict word's prefix is not read
        if why: hold = hold or why; continue
        basis.append((rt, b))
    pathy = [rt for rt, b in basis if b == 'path']
    if pathy: return c.item('J13', 'FAIL', 'row(s) whose reason is path-based (row_basis path 2/2, DEC-139): %s' % [x[:80] for x in pathy[:3]])
    if hold: return c.item('J13', 'HOLD', 'row_basis slot unresolved', hold)
    c.item('J13', 'PASS', '%d row(s), row_basis meaning 2/2' % len(rows))

# ================= CLI =================
def summary(o):
    return '%s %s | ' % (o['run_id'], o['verdict']) + ' '.join('%s=%s%s' % (i['code'], i['verdict'], ':' + i['reason_code'] if i.get('reason_code') else '') for i in o['items']) + (' | warnings: ' + ','.join(o['warnings']) if o['warnings'] else '')

def main(argv):
    if len(argv) >= 3 and argv[1] == 'judge':
        o = run_judge(argv[2]); print(summary(o))
        for i in o['items']: print('  %-3s %-4s %s%s' % (i['code'], i['verdict'], ('[%s] ' % i['reason_code']) if i.get('reason_code') else '', i['evidence']))
        for r in o.get('rs', []): print('  RS  %s' % json.dumps(r, ensure_ascii=False))
    elif len(argv) >= 2 and argv[1] == 'selftest':
        import judge_fixtures; sys.exit(judge_fixtures.selftest(sys.modules[__name__], quick='--quick' in argv))
    else: print(__doc__); sys.exit(2)

if __name__ == '__main__':
    main(sys.argv)
