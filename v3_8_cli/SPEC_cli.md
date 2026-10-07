# v3.8-cli contract (`scripts/drd.mjs`)

Decisions: DEC-076 (S only + output monopoly), DEC-077 (base v3.7, reuse check_run), DEC-078 (group-source gate),
DEC-064 (S codes, CONSISTENT/INCONSISTENT/UNKNOWN, SELF-CHECK line), DEC-066 (reject = boundary + reason + fix),
DEC-071 (unverifiable → UNKNOWN, not failure), DEC-089 (Main count gate). Node 18+, no external packages.

## Commands

```
node scripts/drd.mjs finalize <ir.json> --out <dir> [--decisions <decisions.json>] [--level N] [--expand a,b] [--collapse a,b] [--focus id]
node scripts/drd.mjs verify <dir> [--ir <ir.json>]
node scripts/drd.mjs check <ir.json> [--level N] [--expand ..] [--collapse ..] [--focus id]   # diagnosis only, writes nothing
```

`--decisions` defaults to `decisions.json` next to the IR (absent file = no decisions).

## finalize: gates in order, first failure stops

| Exit | Status token (stdout line `STATUS <token>`) | When |
|---|---|---|
| 2 | `BAD_INPUT` | unreadable JSON, no nodes/edges arrays, dangling edge, unknown --expand/--collapse/--focus id, malformed decisions.json |
| 1 | `INCONSISTENT` | any VB-* rule at level error fails (S2) |
| 4 | `NEEDS_ADJUSTMENT` | VB-MAIN-COUNT warn and neither a Human `info_amount` decision nor an effective `--focus` (S3) |
| 0 | `CONSISTENT` / `REVIEW_PENDING` | outputs written; REVIEW_PENDING when undecided groups exist (below) |

Valid `decision_ref`: id of an entry in `decisions.json` with `subject: "Human"`, `status: "decided"`, non-empty `answer`, `answered_at`.
`info_amount` gate passes when an entry has `topic: "info_amount"`, `subject: "Human"`, `status: "decided"`; or when `--focus` is given and focusStats verdict is `effective` or `not_needed`.

Every non-zero exit: prints one rejection line per failed boundary `REJECT <S-code> <rule-code>: <reason> -> <fix>`; **deletes** any previous
`diagram.svg`, `diagram.html`, `diagram.png`, `ir.json`, `receipt.json` in `--out` (so no stale output survives); writes nothing new.

Undecided groups (DEC-095) are NOT blocked. A group is undecided when its `source` is not `request` and it is not `human` with a valid
`decision_ref`. finalize then: renders the final SVG/HTML/PNG from the IR as written (DEC-133: solid unless the IR itself says `certainty: "dashed"`, which keeps its single meaning "content undecided"; the source IR and out/ir.json stay byte-identical
to the input); sets `STATUS REVIEW_PENDING` (exit 0) instead of CONSISTENT; adds `review_pending: [{group, label, members, candidates:
{A, B|null, page}}]` to the receipt (empty array when none); writes `<out>/candidates/<gid>-A.svg` (= the final diagram.svg),
`<gid>-B.svg` (that group removed, children re-parented; skipped when an edge points at the group node, page then says
"B를 그릴 수 없음") and `<out>/candidates/index.html` (both SVGs inlined, captions "A: 묶음" / "B: 묶지 않음").
Stdout per undecided group, exactly 3 lines:
```
REVIEW <gid>
Human 검토 대기: "<label>"(<member labels joined ", ">)은 Agent가 정한 묶음이다(Human 미검토). 그림은 그대로 그렸고 검토 대기는 이 보고로 알린다. 비교 그림: <abs candidates/index.html>
선택지: A(이대로 묶음) / B(묶지 않음) / 보류
```
Exit 3 / NEEDS_HUMAN no longer exists. S4 check in receipt: CONSISTENT when no undecided group, else UNKNOWN (pending Human review).
verify prints `S4 UNKNOWN: <n> group(s) pending Human review [<gids>]` or `S4 CONSISTENT: ...`; UNKNOWN does not change the exit code.
Asking analysis values (cluster/partition counts) before analysis is judged by the external evaluator, not the CLI (DEC-096).

## finalize: outputs (exit 0 only)

`<out>/ir.json` (byte copy of input IR), `<out>/diagram.svg`, `<out>/diagram.html`, `<out>/diagram.png` (best effort), `<out>/receipt.json`.

- SVG: same rendering as v3.7 `render_svg.mjs` (fit, pad 24, font style, white background).
- HTML: standalone; contains the SVG string **byte-identical** to diagram.svg, plus inline dds.js and the IR for hover (`DDS.attachHover`).
- PNG: v3.7 `to_png.mjs` converter chain; if all fail, no PNG and receipt `png: null` with `png_attempts`.
- receipt.json:
```json
{ "schema": "drd-receipt-v1", "created_at": "...", "ir_source": "<abs path>", "ir_sha256": "...", "decisions_sha256": "...|null",
  "options": {"level":2,"expand":[],"collapse":[],"focus":null},
  "outputs": {"ir": {"path":"ir.json","sha256":"..."}, "svg": {...}, "html": {...}, "png": {...}|null},
  "png_attempts": [...],
  "checks": [{"code":"S2","state":"CONSISTENT","evidence":"..."}, ...],
  "warnings": ["VB-...", ...] }
```

## verify <dir>

Recomputes and prints one line per check, `S<n> <STATE>: <evidence>`:
- S6 outputs: every receipt output exists and sha matches → CONSISTENT; mismatch/missing → INCONSISTENT.
- S8 html embeds svg: diagram.svg string found verbatim in diagram.html → CONSISTENT, else INCONSISTENT.
- S1 source IR unchanged: `--ir` (default `receipt.ir_source`) sha == `receipt.ir_sha256` → CONSISTENT; differs → INCONSISTENT with fix "rerun finalize"; source missing → UNKNOWN.
- S7 png: null → UNKNOWN (DEC-071).
Exit 1 if any INCONSISTENT, else 0. No receipt → exit 2.

## Output tail (finalize, verify, check)

Last line always: `SELF-CHECK ONLY — NOT DONE. Final status is decided by the external judge.`
