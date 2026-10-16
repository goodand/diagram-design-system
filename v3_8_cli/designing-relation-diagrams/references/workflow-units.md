# Workflow Units (v3.92-cli local candidate)

The new pipeline workflow is enforced through the actual `diagram_type` values below. It reuses the existing v3.8 renderer and runtime under the compatible `v3_8_cli/` source path; it does not copy that source tree. The package candidate is `designing-relation-diagrams-v3.92-cli.skill`. This is a local candidate, not a release or a claim that GitHub contains this version.

```text
Function_Definition
  → Process_Summary_Linear | Process_Summary_Router
  → Process_Core (one per Summary Process)
  → Process_Full (only when Summary has 2–3 Processes)
```

The `diagram_type` field is authoritative. If `workflow_unit` is also supplied, it must equal `diagram_type`; a legacy `diagram_type` paired with new `workflow_unit` metadata is invalid. Genuine legacy files without the new metadata remain supported under [workflow.md](workflow.md); they do not satisfy or bypass this sequence.

## Unit contracts

| Unit | Required structure | What is visible |
|---|---|---|
| `Function_Definition` | Exactly one input Entity, one Process, one output Entity | The two E2E Entities and the single Process |
| `Process_Summary_Linear` | 2–3 Processes in one directed chain, one E2E input and one E2E output | E2E Entities and Processes only; no intermediate data Entity or visible edge data label |
| `Process_Summary_Router` | 2–3 Processes in a DAG with an explicit branch, one E2E input and one E2E output; `routing` is `exclusive` or `parallel` | Same visible scope as Linear; routing semantics are recorded in the IR |
| `Process_Core` | One Summary Process reference; at most 9 nodes; exactly one partial membership | Intermediate Entities and transformations for that Process; starts folded |
| `Process_Full` | Same Summary hash; 2–3 approved Cores, exactly one for every Summary Process | Cores start folded. Inter-Core Entities remain visible while Cores are folded. |

Function and Summary diagrams show the end-to-end Entities, not intermediate data. Summary's process-to-process execution edges are visible but do not display carried-data labels. Process_Core and Process_Full may include intermediate Entity nodes. A Process_Summary must have at least two Processes so each stage makes a visible workflow distinction and can map to its own Core.

In Process_Full, each non-loop edge ID listed in `connections` declares direct continuity from one approved Core's output Entity to another Core's input Entity. Tool projection displays this shared boundary once; the ToolUsingAgent does not assign shared node IDs to request merging. Projection only accepts isolated one-to-one pairs: fan-in, fan-out, chained connections, and connections with additional semantic edge annotations fail closed. The connected Entities must have matching semantic fields (layout fields such as coordinates may differ) and be top-level. The producer output ID is retained; Core edges, memberships, and nested E2E references are rewritten to it. Only the declared handoff edge is removed from the rendered graph; its flow and animation metadata remain in `boundary_projection.removed_connection_metadata` for provenance. Labels alone never trigger merging. A real transformation needs an intervening Process. Projection rejects an unmarked cycle or another edge collapsed into a self-loop; authored loop edges elsewhere remain. The source Full, approved Core files, approvals, and hashes remain unchanged. The derived topology invalidates and regenerates layout/routing caches.

`Process_Summary_Linear` is a single chain. `Process_Summary_Router` must have at least one real fan-out in its process graph and declare whether that branch is `exclusive` (one route is selected) or `parallel` (routes may proceed together). A label alone does not turn a Linear chain into a Router. Graph reachability, DAG shape and routing semantics are runtime checks beyond the JSON Schema's structural checks.

## Exact source references

Each reference is relative to the JSON file that contains it. `sha256` is the lowercase SHA-256 of the exact source file bytes, including its line endings. Paths are resolved from the referring file's directory. The source's `id` and `version` and the hash must all match; the referenced node ID must resolve to a `process` node.

```json
{
  "definition_ref": {
    "path": "function-definition.json",
    "id": "budget-function-definition",
    "version": "1",
    "sha256": "<64 lowercase hex characters>",
    "node_id": "analyse-budget-businesses"
  }
}
```

Process_Core uses the same fields in `summary_ref`; its `node_id` is the Summary Process being detailed. Do not add another module key or duplicate process ID. Process_Full uses `summary_ref` without `node_id`, since it refers to the whole Summary.

The chain is validated recursively: Summary must reference the exact Function file; each Core and the Full must reference the exact Summary file; each Core must resolve to one still-current Summary Process. A changed ancestor makes descendants stale until their exact references are updated. Stable node IDs, not labels or geometry, are the linkage key. No `module_id`, composite key or separately supplied boundary map is part of this contract.

## Core membership and Full assembly

Every Process_Core has one `partials` entry, representing that Core's node and edge membership. `summary_ref.node_id` identifies its owner Process. There can be no more than one current Core for a Summary Process. Full must contain 2–3 Cores from the exact same Summary version and hash, with no duplicates and with every Summary Process covered once. Linear/Router summaries with 2–3 Processes can therefore proceed to Full after each Core is approved.

Core and Full may have multiple E2E inputs and outputs. Function and Summary each have exactly one of each, and each Summary has 2–3 Processes. Function/Summary endpoint IDs and labels carry into their linked Units. Core-internal data is authored at Core; do not infer it from or force it to match `Summary.flow`.

Full preserves the graph represented by the Summary: Core input/output boundaries and their links must reconstruct the Summary's Process graph. Reuse a shared Entity already present in the approved Cores, or declare an added edge joining their existing data boundaries; do not add a new semantic Entity during assembly. Preserve approved nodes, edges, flow labels and memberships. Data passed between Cores remains visible when the Core boxes are folded; data internal to a Core appears when that Core is expanded. The exact graph comparison is enforced by the CLI; the schema only checks the fields and broad counts.

The existing approval record shape is retained:

```json
{
  "approved_partials": [{
    "id": "record-building",
    "version": "2",
    "path": "process-core-preprocessing.json",
    "sha256": "<Core file SHA-256>",
    "decision_ref": "D-core-record-building-v2"
  }],
  "assembly_decision_ref": "D-assemble-full-v1"
}
```

`approved_partials` entries identify exact Core files. Their owning Summary Process is taken from each Core's `summary_ref.node_id`, so the approval entry does not duplicate it. The sidecar `decisions.json` contains the Human's Core approval and separate Full assembly decision. The Agent may propose an assembly; two or more available Cores do not trigger one automatically. The actual Human must decide before the CLI accepts Full assembly. Both Core approval and assembly records require `outcome: "approved"` in addition to `status: "decided"`. Rejected, deferred, and missing outcomes are not approvals; answer text is preserved without interpreting it as authorization. Existing records are not automatically migrated. A referenced decision ID must occur exactly once; duplicate IDs cannot authorize by array order.

For tests only, a synthetic decision must explicitly set `simulated: true`, and the workflow-unit JSON must set root `simulation: true`; include an unmistakable `SIMULATED` ID or answer. The CLI accepts simulated Human-decision records only when the root flag is enabled. A synthetic record is test data, never an actual Human review. The CLI validates the recorded decision contract and hashes; it cannot authenticate who wrote a record or prove the real-world chronology of a review. A recorded Human decision is an input claim, not cryptographic identity proof.

## Stage guidance and display behavior

### Semantic Flow Token states

`flow` names carried data for source consistency. New animated Full diagrams should also provide `animation_states`, an edge-ID map of concise processing states or artifact types. For example, use `접수됨`, `의도 분류됨`, `핵심 내용 정리됨`, `초안 작성됨`, `전달 완료`, rather than repeating `고객 문의` or input content. A transfer with no transformation keeps its preceding state; do not invent a new state at every edge just to create motion. Meaning is reviewed by the Agent and Human, not determined by string validation.

When supplied, the map must cover all execution edges with nonempty strings and no unknown IDs. Token labels prefer it over `flow`; old files without the map remain compatible. Approved Core states, when present, must be preserved during Full assembly. For older Cores without the map, Full may add it as presentation metadata without modifying approved Core files. Default token travel is 1800 ms per edge; new Hover or leaving the input still cancels immediately.

The CLI's default context is `Function_Definition`. As workflow practice, show each Unit to the Human for feedback before proceeding and use the CLI-reported next action rather than creating later JSON by hand. Runtime validation enforces exact parent references and structure; it does not require a Human approval record for Function, Summary, or Core authoring. Full assembly is gated on its explicit Core approvals and separate Human assembly decision. A parent file reference proves which exact source a child claims to refine, but file timestamps or hashes alone do not prove that a person reviewed it.

```sh
node scripts/drd.mjs version
node scripts/drd.mjs context
node scripts/drd.mjs schema
node scripts/drd.mjs workflow <unit.json> [--decisions <decisions.json>]
node scripts/drd.mjs finalize <unit.json> --out <output-dir>
node scripts/drd.mjs verify <output-dir>
```

Function_Definition and both Process_Summary types have no folding or token animation. Process_Core and Process_Full start collapsed. Full folding is a view operation and retains Inter-Core data. Semantic Flow Token playback is available only in Process_Full: Hover/focus on the initial E2E input starts the finite flow, each transformation uses its `flow` label, and leaving the input or moving to another Hover cancels it. Normal playback has no Play/Stop controls; a separate control is reserved for an explicitly supplied example animation.

Use the renderer to produce SVG/HTML/PNG; do not hand-edit those outputs. Revisions create a new JSON version and preserve prior artifacts. If Full review reveals a faulty Core boundary, revise and review that Core, then rebuild Full against the new exact hash. Do not copy an earlier approval to changed content.

## Optional automatic routing (v3.94)

Set top-level `edge_routing: "libavoid"` before `finalize` to keep node positions and compute non-overlapping orthogonal routes for every fold state. This overrides manual edge route/busX geometry. At most eight fold groups are supported. Invalid routing fails explicitly; generated HTML works offline. Token animation follows the rendered routes. Edge crossings and universal label collision avoidance are not guaranteed.
