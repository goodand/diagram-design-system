# Legacy typed workflow (v3.8-cli)

This file documents the earlier `l0_summary/l1_partial/l1_full` contract. Keep it for historical inputs and compatibility. New pipeline work uses the actual workflow units in [workflow-units.md](workflow-units.md) and [workflow-units.schema.json](workflow-units.schema.json); do not mix the two contracts.

The workflow is `l0_summary -> l1_partial -> l1_full`. This is progressive authoring/refinement, not a folding operation. Depth (L0/L1/L2), input/output-versus-Task emphasis, and diagram type are independent criteria. L2 requires an explicit request.

## Agent entry points

```sh
node scripts/drd.mjs context l0_summary
node scripts/drd.mjs schema l1_full
node scripts/drd.mjs workflow diagram.json --decisions decisions.json
node scripts/drd.mjs finalize diagram.json --out out
node scripts/drd.mjs verify out
```

`context` supplies the type contract and relevant expression/relation guidance. `schema` emits JSON Schema. `workflow` returns the current stage, review version, approved versions, required feedback and next actions. Agent authors JSON; the bundled renderer/runtime produces all visual behavior.

- `l0_summary`: one representative input, the necessary core Tasks in flow order, and one representative output. Do not force independently refinable Tasks into one node. Intermediate data may be omitted at this summary level. Vertical default; no folding, Dimming, or token animation. Default level 0.
- `l1_partial`: one partial scope, reviewed as an independently versioned artifact. Folding is a view operation. Default level 1.
- `l1_full`: manually copied approved partials; at least two distinct approved versions. Agent proposes the selected versions to Human. Human decides whether to assemble them; reaching two does not trigger generation. The v3.8 experiment record described the initial full view as expanded at level 1. The current local renderer starts Full folded; the earlier statement is historical behavior, not the current display default. More than nine nodes is allowed without a count approval gate.
- Unversioned legacy IR without `diagram_type` keeps its original level-2 default and existing gates for historical experiments. These experiments do not establish correctness of the new workflow.

## Input contract

Typed IR adds `id`, `version`, `diagram_type`, `e2e: {inputs: [node IDs], outputs: [node IDs]}` and `flow: {edgeId: "carried data/artifact"}`. Nodes and edges have stable, unique IDs. Name the carried artifact for each execution-flow edge: a Task's outgoing artifact can differ from its incoming artifact. This is semantic delivery/transformation, not execution-state telemetry. Branches are illustrated in deterministic topological order, not simulated concurrent execution. Explicit `loop` edges are excluded from playback.

`partials` records `{id, nodes: [IDs], edges: [IDs]}`. The same node/edge ID may belong to multiple partials. Partial membership is independent of the folding hierarchy (`parent`, `expandAt`).

### Automatic folding to the L0 Task

When authoring a new partial, include `l0_ref` before requesting approval. The only link key is `node_id`, resolved within the supplied L0 `snapshot`. Keep the ID when changing a label or layout. No module ID, composite key or separate boundary mapping is needed; the existing L1 `e2e` fields supply its boundaries.

```json
{
  "l0_ref": {
    "node_id": "analyse-budget",
    "snapshot": { "...": "complete l0_summary IR" }
  }
}
```

The snippet illustrates the reference fields; replace `snapshot` with real L0 JSON. The bundled renderer derives the folding structure. Do not manually add parent/group nodes for this link. Folding keeps the actual partial boundary labels, including intermediate artifacts, and shows the referenced L0 Task. Expanding restores the original partial nodes and edges. Linked `l1_partial` and current local `l1_full` start folded; L0 itself has no folding interaction. This old reference contract is not the new Process_Core/Process_Full reference schema.

Full diagrams derive these links from the approved partial files. Partials referencing the same `node_id` collapse together to one Task; conflicting Task definitions are rejected. This is a view transformation, not a rewrite of approved content. Older inputs without `l0_ref` keep their previous behavior; add the reference in a new draft version and obtain its approval instead of editing approved bytes.

For `l1_full`, `approved_partials` contains `{id, version, path, sha256, decision_ref}`. Paths resolve relative to the full IR. Keep the approved partial JSON files available for revalidation. A `partial_approval` decision in the separate decisions file must have `subject: "Human"`, `status: "decided"`, a nonempty `answer`, `answered_at` and the snapshot's `ir_sha256`. Never synthesize Human responses outside test fixtures.

`assembly_decision_ref` references a Human `assemble_full` decision with `partial_sha256` selecting precisely the approved snapshot hashes. File hashes bind exact approved bytes; copied content is compared by normalized JSON ignoring key order and geometry.

Also record `ir_path` in each `partial_approval` decision, preferably an absolute path when sharing a decisions file across directories. This lets `workflow` discover approved versions before a full IR exists. An approval without a path is reported as `unindexed_approvals` with the next action `add_ir_path_to_approval_records`. Store this index in the separate decisions file; do not modify an approved partial to add references to itself. `current_version_approved` compares the current file's exact hash with approval records.

Preserve IDs, labels, node roles, edge endpoints/meaning, partial memberships and flow labels. Geometry (`x/y/w/h/pos`, edge routing offsets) may change. Keep shared IDs consistent across approved snapshots; incompatible versions require correction/reapproval of the relevant partial. Added inter-partial semantic edges must be declared in `connections`; they are reported for assembly review. Animation overlays are generated by the runtime and never inserted as semantic nodes. This check verifies recorded evidence, not the real-world identity of the person who wrote it.

New connections must join the approved output of one partial to the approved input of a different partial, using `execution_flow`. Adding an internal relation inside an approved partial is rejected even if listed in `connections`. Preserve every approved E2E endpoint unless a connection/shared node makes it internal. No arbitrary overlay-authoring API is provided; built-in token overlays and explicit flow labels supply the animation additions.

## Interaction

Focus interactions apply to `l1_partial` and `l1_full`. Playback applies only to `l1_full`. L0 is static; neither L0 nor `l1_partial` has animation or replay/Stop controls. Partial folding and Hover focus remain available.

The initial full view has no extra Dimming. Hovering a unique node/edge activates its partial; hovering a shared node/edge activates the union of its partials. Reachability from the selected scope's boundaries identifies related E2E input/output endpoints. Those endpoints are emphasized, but intervening Tasks belonging to other partials stay dimmed. Otherwise a linear pipeline would always highlight everything.

Only initial E2E input Hover starts one finite playback. Token labels change according to `flow`. Leaving that input immediately removes the token and cancels scheduled frames. Hovering another element stops playback and applies its scope. Moving within the same input does not restart it. Moving to blank space restores the default view.

Normal flow playback starts through initial-input Hover (or keyboard focus), without Play or Stop buttons. Leaving the input stops playback. Reserve separate playback controls for an explicitly supplied example animation; do not add example controls when there is no example animation. Reduced-motion preference uses stationary edge steps. Folding controls start at partial level and affect only the view; approval content remains unchanged.

The workflow does not impose an additional full-diagram Human approval gate. Human review of the assembled view is a next action; generation authorization and post-generation review are separate.

Full-view review may reveal incorrect partial boundaries or L0 Task links. Return the affected partials to new draft versions, record the full-view feedback and superseded versions, and review them again. Preserve previous approved files and the earlier full; do not transfer old approval hashes to revised content. Reassemble the selected revised versions after their review. This feedback loop is part of the authoring workflow.
