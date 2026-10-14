# Linked detail in Full

Author: chatgpt_gpt6

Reuse Function_Definition -> Summary -> Core -> Full to author an independent
detail diagram. A parent Process_Full can attach the approved child Full to one
process using `linked_diagrams`. No new diagram type is required. Only one
external expansion level is supported; the referenced Full must not have links.

Each entry has `node_id`, `definition_ref`, `full_ref`, `decision_ref`, and
`boundary_map`. Refs contain `path`, `id`, `version`, `sha256`; definition_ref
also identifies its Function process with `node_id`. Paths resolve relative to
the parent IR file. boundary_map maps each child E2E entity ID to the matching
parent input/output entity adjacent to the replaced process. Direction, labels,
coverage, version and SHA are checked; arbitrary semantic equivalence is not inferred.

The target must belong to exactly one parent Core and have entity boundaries.
The child retains its normal exact Core approvals and assembly decision. The
additional Human decision has topic `linked_diagram_approval`, `parent_node_id`,
`ir_sha256` for the child Full, plus id/subject/status/answer/answered_at. Simulated
decisions require the root simulation flag and are never real Human approvals.

Composition affects presentation only. Source Full, child JSON and approved
snapshots are preserved. Internal IDs are namespaced; mapped boundary entities
are reused. Unfolding replaces the target with child detail, rather than showing
both as separate execution steps. Child layout is translated, not automatically
repacked; author adequate space and inspect the final rendered view. The child
Full opens as its detailed Core union; its own Summary fold wrappers are not
imported as another navigation level.

Hover on a collapsed detail activates its child Core union. On an expanded child
node or edge it activates the matching detailed Core memberships; their own
ancestor Core is excluded. Shared nodes activate unions, not intersections.
Unrelated peer scopes remain eligible at a shared external boundary. A collapsed
root Core still represents its complete scope. Only visible projections are lit;
the remaining visible elements are dimmed. Folding clears focus and tokens.
Use All expand / All collapse for the complete view. Existing initial E2E Hover
animation follows composed edges and the same rendered paths.
