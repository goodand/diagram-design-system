# CLI contract (`scripts/drd.mjs`)

The source remains under `v3_8_cli/` for compatibility with existing paths. The active local candidate reports `v3.92-cli`; this does not declare a GitHub release. Older v3.8-cli commands and legacy typed input are retained.

Decisions: DEC-076 (S only + output monopoly), DEC-077 (base v3.7, reuse check_run), DEC-078 (group-source gate),
DEC-064 (S codes, CONSISTENT/INCONSISTENT/UNKNOWN, SELF-CHECK line), DEC-066 (reject = boundary + reason + fix),
DEC-071 (unverifiable → UNKNOWN, not failure), DEC-089 (Main count gate). Node 18+, no external packages.

## Commands

```
node scripts/drd.mjs version
node scripts/drd.mjs context [diagram_type]
node scripts/drd.mjs schema [diagram_type]
node scripts/drd.mjs workflow <ir.json> [--decisions <decisions.json>]
node scripts/drd.mjs finalize <ir.json> --out <dir> [--decisions <decisions.json>] [--level N] [--expand a,b] [--collapse a,b] [--focus id]
node scripts/drd.mjs verify <dir> [--ir <ir.json>]
node scripts/drd.mjs check <ir.json> [--level N] [--expand ..] [--collapse ..] [--focus id]   # diagnosis only, writes nothing
```

`--decisions` defaults to `decisions.json` next to the IR (absent file = no decisions).

For v3.92-cli Workflow Units, omitted `diagram_type` in `context` or `schema` defaults to `Function_Definition`. Supported actual values are `Function_Definition`, `Process_Summary_Linear`, `Process_Summary_Router`, `Process_Core`, and `Process_Full`. `version` prints the candidate version. See [workflow-units.md](designing-relation-diagrams/references/workflow-units.md) and [workflow-units.schema.json](designing-relation-diagrams/references/workflow-units.schema.json).

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
# Legacy typed Workflow extension (2026-10-12, v3.8-cli)

`context <diagram_type>` supplies workflow/expression context; `schema <diagram_type>` emits JSON Schema; `workflow <ir> [--decisions f]` returns versioned stage, approval evidence and next actions. These commands emit JSON. The detailed contract is [workflow.md](designing-relation-diagrams/references/workflow.md).

Typed inputs default to level 0 for `l0_summary`, level 1 for `l1_partial`/`l1_full`. Legacy inputs retain level 2. S5 WORKFLOW rejects missing/mutated approved content or missing Human assembly authorization. `l1_full` is exempt from the S3 nine-node gate. Successful receipts add `workflow`; legacy fields and exit codes remain compatible. This extension does not rerun or redefine historical LLM experiment results.

Automatic folding uses an older partial's `l0_ref` (`node_id` resolved within a supplied L0 `snapshot`). This compatibility behavior is not the v3.9 Workflow Unit reference contract. See `references/workflow.md` for the legacy JSON contract.

## v3.92-cli Workflow Units (local candidate)

`diagram_type` is the actual Unit type and controls validation and rendering. The CLI enforces the sequence `Function_Definition → Process_Summary_Linear/Router → Process_Core → Process_Full`; file references bind exact parent IDs, versions, hashes, and selected node IDs. A Full assembly requires 2–3 hash-bound approved Cores from one Summary, complete one-to-one Process coverage, and a separate Human assembly decision. Summary requires 2–3 Processes; a one-Process Summary is rejected even when its diagram_type is explicitly selected. Function_Definition remains exactly one Process. The JSON Schema provides structural limits; the CLI checks cross-file hashes, topology, ownership and approval records. This contract does not authenticate the person who wrote a decision or prove real-world review chronology. Synthetic decisions are accepted only when explicitly marked `simulated: true` and are test data, not Human approvals.

Function and Summary use E2E Entity boundaries only; Summary shows no intermediate data Entity or edge data labels. Core is limited to 9 nodes and may expose intermediate data. Full preserves inter-Core data and starts with Cores folded. Semantic Flow Token runs only in Full from the initial E2E input Hover. The renderer maps these Units onto the compatible L0/L1 runtime without replacing their actual `diagram_type` values. Legacy `workflow.schema.json` remains unchanged.

`animation_states` optionally maps execution edge IDs to processing-state/type labels. New Full authoring uses these labels for Semantic Flow Tokens; legacy files fall back to `flow`. When supplied, every edge must have a nonempty state label. Approved Core state labels remain immutable. The default travel time is 1800 ms per edge and Hover exit/change cancels immediately. Example playback remains out of this change.
# 2026-10-15 View filename contract update

For typed IR, replace historical `diagram.*` output names in this specification with `function.common.*`, `summary.common.*`, `core.human.*`, or `full.human.*`. Consumers must read `receipt.outputs[kind].path`; legacy untyped IR retains `diagram.*`. Cleanup covers both old and new recognized names. Independent Core emits `core.agent.svg/png`; capture commands emit `core.human.<state>.png` or `full.human.<state>.png`. These optional commands are not invoked by finalize. See designing-relation-diagrams/references/view-artifacts.md.
