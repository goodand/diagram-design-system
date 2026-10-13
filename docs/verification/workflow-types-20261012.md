# v3.8-cli Workflow implementation, 2026-10-12

Base commit: `4425c8d0d45693196670fda4c3c3570842548187`. Development branch: `feat/diagram-workflow-types`. No new release version is declared.

## Before/after coverage

| Area | Implementation |
|---|---|
| Default workflow | Summary → partial authoring/review → Human-authorized assembly; two approvals permit a proposal, not automatic generation |
| Refinement vs folding | Separate versioned authoring and view-only expand/collapse; L0 has neither folding nor dimming |
| Three types | `diagram_type` dispatches prebuilt runtime; legacy IR remains compatible |
| IR contract | JSON Schema, E2E endpoints, partial memberships, explicit per-edge artifact labels and approved snapshot references |
| L0 | One input → one core Task → one output; vertical default independent of input array order |
| Partial approval | SHA-256 bound Human records; manual copies compared semantically; geometry changes allowed |
| Full emphasis | Shared-membership union or unique partial plus related E2E endpoints; other partials' intermediate Tasks stay dimmed; no nine-node block |
| Interaction | Initial-input Hover starts finite playback; leave/new Hover cancels frames and token; replay/stop buttons; transformed artifact labels |
| Agent context | CLI `context` provides workflow, expression and execution-flow guidance; `schema` returns JSON Schema |
| Workflow status | Stage, review version, approved versions, feedback and next actions in JSON and receipts; `verify` rechecks approval evidence |

## Relation to existing experiments

The v3.7 comparison tests, undecided-group tests, output integrity tests and historical evaluation artifacts are preserved. `JUDGE_CRITERIA.md` distinguishes semantic correctness, render integrity and actual interaction tests; its GC-3/GC-4 discussion explicitly warns against treating nine nodes as a universal cap. The new full-type exemption is scoped; historical legacy checks remain unchanged.

Tests use synthetic approvals marked as TEST DATA. They are not approvals of real project diagrams. The full LLM judge selftest and 36-run main experiment are not rerun; previous J8 results are not claimed as evidence for this implementation.

## Reproduce

From `v3_8_cli/designing-relation-diagrams`:

```sh
node --test test/cli.test.mjs test/workflow.test.mjs
node test/browser-workflow.mjs /absolute/path/to/test-artifacts
```

The browser test needs Playwright, optionally supplied by `PLAYWRIGHT_MODULE`, and a supported Chromium installation, optionally supplied by `DDS_BROWSER`. Production CLI/runtime have no new external package dependencies. Browser tests generate a 13-node full graph, individual partials and a three-node summary, then verify shared/unique Hover, changing token labels, cancellation, finite replay, L0 behavior and folding. Generated PNG screenshots are browser evidence, not production CLI PNG output.

Human approval is a recorded input contract, not cryptographic authentication of a person. Token playback illustrates authored data flow in deterministic order; it is not an execution simulator. No new post-assembly approval gate is imposed.

## Verified outcome

- Existing CLI regression: 59/59 passed. New workflow regression: 15/15 passed (74 total).
- Headless Edge: 14 interaction checks passed; no browser page errors. Includes shared projected edges, folded summaries, reduced-motion keyboard cancellation and retained focus during playback.
- Skill frontmatter validator: passed (UTF-8 mode; isolated PyYAML dependency for the validator only).
- Independent code reviews identified and drove fixes for lost input emphasis, dead-end playback, folded membership, unapproved internal connections and omitted E2E endpoints.
- Fresh subagent authoring and a separate native-GUI Codex session both completed summary → two partials → simulated approvals → proposal → separately authorized full assembly. The GUI session also handled a wording correction before partial authoring, preserved approved source hashes and produced an 11-node full diagram. No implicit assembly or fabricated real approval was observed.
- Fresh use exposed a missing approval-path index and inaccurate count-gate reporting; both were repaired. `ir_path` lets the CLI discover approvals without modifying frozen source files. Full count is informational, not a warning requesting approval.
- The fresh sessions could not open local HTML in their browser tool due to that tool's URL policy and did not bypass it. Their evidence covers CLI use and image inspection. Actual interaction evidence comes from the separate, generated Edge regression fixtures.
- The `.skill` package contains 48 source files, normalized to Git's LF text representation; the package manifest records hashes. Historical baseline/evaluation files and the original design document are unchanged. Full historical LLM experiments were not rerun.
