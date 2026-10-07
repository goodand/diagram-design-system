#!/usr/bin/env python3
"""drd eval runner: one subject run with a simulated Human (DEC-083).
usage: drd_eval.py run --case GC-1 --skill <skill dir> --arm v3.8 --effort medium --rep 1 [--model sonnet]
       drd_eval.py page <run dir>
A run lives in /private/tmp/drd-eval/<run-id> (outside ~/.claude, DEC-100) and is copied to eval/runs/<run-id>.
Question handling: an LLM only classifies the subject's last message into a pre-registered topic (slot);
the answer itself is looked up by rule in eval/prereg/<case>.json and sent only after a question appeared."""
import argparse, base64, html, json, os, shutil, subprocess, sys, time
from pathlib import Path

EVAL = Path(__file__).resolve().parent
TASKS = json.loads((EVAL / 'gc_tasks_human_rewrite.json').read_text(encoding='utf-8'))
SETUP = ('이 작업에는 .claude/skills/designing-relation-diagrams skill을 쓴다. SKILL.md부터 READ한다. '
         'skill이 Human에게 질문하라고 하면 추측하지 말고 실제로 질문하고, 답을 받은 뒤 진행한다.')
TOOLS = 'Bash Read Write Edit Glob Grep Skill'
MAX_TURNS = 6


def claude(args, cwd, out):
    with open(out, 'w') as f:
        subprocess.run(['claude', *args], cwd=cwd, stdout=f, stderr=subprocess.DEVNULL, stdin=subprocess.DEVNULL)
    return [json.loads(l) for l in open(out) if l.strip()]


def classify(msg, topics, cwd):
    """LLM fills one slot: does the message ask the Human something, and which topic."""
    p = ('Classify the assistant message below. Answer with JSON only, no prose: '
         '{"asks_human": true|false, "topic": one of ' + json.dumps(topics) + '}.\n'
         'asks_human is true only if the message ends by asking the user to decide or confirm something before continuing.\n'
         'Use "fallback" if no topic fits.\n\nMESSAGE:\n' + msg)
    r = subprocess.run(['claude', '-p', p, '--model', 'haiku', '--output-format', 'json', '--setting-sources', 'project',
                        '--disallowedTools', TOOLS], cwd=cwd, capture_output=True, text=True, stdin=subprocess.DEVNULL)
    txt = json.loads(r.stdout).get('result', '')
    s, e = txt.find('{'), txt.rfind('}')
    try:
        j = json.loads(txt[s:e + 1])
    except Exception:
        j = {'asks_human': False, 'topic': 'unregistered', 'parse_error': txt[:200]}
    if j.get('topic') not in topics: j['topic'] = 'fallback' if 'fallback' in topics else 'unregistered'
    return j


def choose(msg, intent, cwd):
    """Second slot (JUDGE_CRITERIA R2): if the message offers options, pick the one closest to the pre-registered intent."""
    p = ('The assistant message below may end with a list of options for the user. The user\'s fixed intent is: "' + intent + '".\n'
         'Answer JSON only: {"has_options": true|false, "choice": "<the option label exactly as written, e.g. 1, A, 3개>" or null}. '
         'Pick the option whose meaning is closest to the intent; null if none fits.\n\nMESSAGE:\n' + msg)
    r = subprocess.run(['claude', '-p', p, '--model', 'haiku', '--output-format', 'json', '--setting-sources', 'project',
                        '--disallowedTools', TOOLS], cwd=cwd, capture_output=True, text=True, stdin=subprocess.DEVNULL)
    txt = json.loads(r.stdout).get('result', ''); s, e = txt.find('{'), txt.rfind('}')
    try: return json.loads(txt[s:e + 1])
    except Exception: return {'has_options': False, 'choice': None}


def run(a):
    case = next(c for c in TASKS['cases'] if c['id'] == a.case)
    prereg = json.loads((EVAL / 'prereg' / f'{a.case}.json').read_text(encoding='utf-8'))
    rid = f'{a.case}_{a.arm}_{a.effort}_r{a.rep}'
    R = Path('/private/tmp/drd-eval') / rid
    shutil.rmtree(R, ignore_errors=True); (R / '.claude' / 'skills').mkdir(parents=True)
    shutil.copytree(a.skill, R / '.claude' / 'skills' / 'designing-relation-diagrams', ignore=shutil.ignore_patterns('test'))
    for f in case.get('files', []): shutil.copy(EVAL / f, R / f)
    cls_dir = R.parent / (rid + '__cls'); cls_dir.mkdir(exist_ok=True)
    base = ['--model', a.model, '--effort', a.effort, '--permission-mode', 'acceptEdits', '--allowedTools', TOOLS,
            '--setting-sources', 'project', '--output-format', 'stream-json', '--verbose']
    log = {'run_id': rid, 'case': a.case, 'arm': a.arm, 'effort': a.effort, 'model': a.model, 'rep': a.rep,
           'skill': str(a.skill), 'started': time.strftime('%Y-%m-%dT%H:%M:%S'), 'turns': []}
    msg, sid = SETUP + '\n\n' + case['query'], None
    for t in range(1, MAX_TURNS + 1):
        ev = claude(['-p', msg, *(['--resume', sid] if sid else []), *base], R, R / f'turn{t}.jsonl')
        sid = sid or next(x['session_id'] for x in ev if x.get('session_id'))
        res = [x for x in ev if x.get('type') == 'result'][-1]
        out = res.get('result', '')
        c = classify(out, [k for k in prereg['answers_by_topic'] if k != 'l0_or_render_feedback_after_first'], cls_dir)
        turn = {'turn': t, 'input': msg, 'output': out, 'cost': res.get('total_cost_usd', 0), 'classifier': c}
        log['turns'].append(turn)
        if not c.get('asks_human'): break
        ans, topic = prereg['answers_by_topic'], c['topic']
        if topic == 'l0_or_render_feedback' and 'l0_or_render_feedback_after_first' in ans and any(x['classifier'].get('topic') == topic for x in log['turns'][:-1]):
            topic = 'l0_or_render_feedback_after_first'
        msg = ans.get(topic, ans.get('fallback', ans.get('unregistered')))
        ch = choose(out, msg, cls_dir); turn['choice'] = ch
        if ch.get('has_options') and ch.get('choice'): msg = f"{ch['choice']}. {msg}"
        turn['answer'], turn['answer_topic'], turn['proxy_fallback'] = msg, topic, topic in ('fallback', 'unregistered')
    log['finished'] = time.strftime('%Y-%m-%dT%H:%M:%S')
    (R / 'run.json').write_text(json.dumps(log, ensure_ascii=False, indent=1), encoding='utf-8')
    dest = EVAL / 'runs' / rid
    shutil.rmtree(dest, ignore_errors=True)
    shutil.copytree(R, dest, ignore=shutil.ignore_patterns('.claude'))
    page(dest); print(dest / 'index.html')


def tool_calls(jsonl):
    out = []
    for l in open(jsonl):
        x = json.loads(l)
        if x.get('type') == 'assistant':
            for c in x['message']['content']:
                if c['type'] == 'tool_use':
                    i = c['input']; out.append(f"{c['name']}: {(i.get('command') or i.get('skill') or i.get('file_path') or json.dumps(i, ensure_ascii=False))[:240]}")
    return out


def page(d):
    d = Path(d); log = json.loads((d / 'run.json').read_text(encoding='utf-8'))
    pngs = sorted(p for p in d.rglob('*.png') if 'candidates' not in p.parts)
    imgs = ''.join(f'<div class="im"><h4>{html.escape(str(p.relative_to(d)))}</h4><img src="data:image/png;base64,{base64.b64encode(p.read_bytes()).decode()}"></div>' for p in pngs)
    turns = ''
    for t in log['turns']:
        tc = tool_calls(d / f"turn{t['turn']}.jsonl")
        turns += (f"<h3>턴 {t['turn']}</h3><pre class='in'>{html.escape(t['input'])}</pre>"
                  f"<details><summary>도구 호출 {len(tc)}개</summary><pre>{html.escape(chr(10).join(tc))}</pre></details>"
                  f"<h4>Agent 답</h4><pre>{html.escape(t['output'])}</pre>"
                  f"<p class='c'>분류기: {html.escape(json.dumps(t['classifier'], ensure_ascii=False))}</p>")
    cost = sum(t['cost'] for t in log['turns'])
    (d / 'index.html').write_text(f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>{log['run_id']}</title>
<style>body{{font-family:-apple-system,"Apple SD Gothic Neo",sans-serif;margin:24px;max-width:1200px}}pre{{white-space:pre-wrap;font-size:12px;background:#f6f8fa;padding:8px;border-radius:4px}}
pre.in{{background:#fff8c5}}.c{{font-size:12px;color:#555}}.im img{{max-width:100%;border:1px solid #ccc}}</style></head><body>
<h1 style="font-size:20px">{log['case']} — {log['arm']}, {log['model']}, effort {log['effort']}, 반복 {log['rep']}</h1>
<p>턴 {len(log['turns'])}개, 비용 ${cost:.2f}. 질문이 나오면 사전등록 답(eval/prereg/{log['case']}.json)으로 이어 감.</p>
<h2 style="font-size:16px">산출물 그림</h2>{imgs or '<p>PNG 없음</p>'}<h2 style="font-size:16px">대화</h2>{turns}</body></html>''', encoding='utf-8')


def compare(dirs, out):
    cols = ''
    for d in map(Path, dirs):
        log = json.loads((d / 'run.json').read_text(encoding='utf-8'))
        pngs = sorted(p for p in d.rglob('*.png') if 'candidates' not in p.parts)
        imgs = ''.join(f'<h4>{html.escape(str(p.relative_to(d)))}</h4><img src="data:image/png;base64,{base64.b64encode(p.read_bytes()).decode()}">' for p in pngs)
        qa = ''.join(f"<li>턴 {t['turn']}: {'질문함 → 답: ' + html.escape(t.get('answer', '')) if t['classifier'].get('asks_human') else '질문 없음(종료)'}</li>" for t in log['turns'])
        cost = sum(t['cost'] for t in log['turns'])
        cols += (f"<div class='col'><h2>{log['arm']} <small>{log['model']} · effort {log['effort']} · r{log['rep']}</small></h2>"
                 f"<p>턴 {len(log['turns'])}개 · ${cost:.2f} · <a href='{os.path.relpath(d / 'index.html', Path(out).parent)}'>전체 기록</a></p><ul>{qa}</ul>"
                 f"<details><summary>최종 답</summary><pre>{html.escape(log['turns'][-1]['output'])}</pre></details>{imgs}</div>")
    Path(out).write_text(f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>비교</title><style>body{{font-family:-apple-system,"Apple SD Gothic Neo",sans-serif;margin:24px}}
.g{{display:grid;grid-template-columns:repeat({len(dirs)},1fr);gap:16px}}.col{{border:1px solid #ddd;border-radius:6px;padding:10px;min-width:0}}img{{max-width:100%;border:1px solid #ccc}}
pre{{white-space:pre-wrap;font-size:12px;background:#f6f8fa;padding:8px}}h2{{font-size:17px}}small{{font-weight:400;color:#666}}</style></head><body>
<h1 style="font-size:20px">{html.escape(log['case'])} — 같은 과제, 판별 비교 (판정 전, 관찰용)</h1><div class="g">{cols}</div></body></html>''', encoding='utf-8')
    print(out)


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); sp = ap.add_subparsers(dest='cmd', required=True)
    r = sp.add_parser('run')
    for k in ('case', 'skill', 'arm', 'effort'): r.add_argument('--' + k, required=True)
    r.add_argument('--rep', type=int, default=1); r.add_argument('--model', default='sonnet')
    sp.add_parser('page').add_argument('dir')
    c = sp.add_parser('compare'); c.add_argument('dirs', nargs='+'); c.add_argument('--out', required=True)
    a = ap.parse_args()
    run(a) if a.cmd == 'run' else page(a.dir) if a.cmd == 'page' else compare(a.dirs, a.out)
