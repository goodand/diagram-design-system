# DDS goal and evidence audit

Status: active; overall completion is not established. Recorded 2026-10-16.

## User-defined purpose

Human의 이해를 돕기 위해 Agent가 Human이 이해하기 적합한 Diagram으로 표현하는 Agent Tool.

The current target relation is execution flow, for both existing systems and systems being designed. Meaning consistency and suitability for Human understanding overlap; they are not forced into disjoint categories. DDS does not decide which source content is necessary or substantively correct. ToolUsingAgent authors meaning/topology; Tool provides consistent presentation. Lower-level presentation choices may change when stronger evidence supports the higher purpose. Execution order is not purpose priority.

## Requirements and current evidence

Evidence paths below are relative to the workspace `outputs/` directory, outside this Git repository. They are local evidence, not public links or release contents.

| Requirement | Current evidence | Scope / remaining work |
|---|---|---|
| Progressive Function → Summary → Core → Full, exact source references and actual approval provenance | Repository tests, including workflow-contract-completion.test.mjs; boundary-product-check repository-tests.log | 168 tests passed before the latest Core interaction correction. Synthetic test approvals are not Human approvals. |
| Agent authors topology without having to author coordinates | auto-layout.mjs, CLI preparation, updated context and SKILL | Integrated; coordinate-free CLI and Independent Core tests pass. |
| Full shared boundary appears once while preserving approved source meaning | boundary-normalization comparison-checks.json; boundary-product-check topology/checks.json | Nine ordered topology pairs × four fold states. Only declared one-to-one identity connections are normalized. |
| Folded / expanded representations preserve connections | Same 36 states; image-comparison.json | Repository and isolated screenshots byte-identical before latest interaction-only correction. Seven candidate images directly read, not all images claimed visually reviewed. |
| Full Hover follows Core membership union and relevant E2E endpoints | boundary-product-check interactions.json | Nine pairs; exact first-Core node membership checked independently of runtime scope(). Other Core, edge and partial-state Hover scopes need broader coverage. |
| Core has folding but Full-only Hover/Dimming | boundary-product-check core-hover-before and core-hover-after browser-check.json | Before fails, after passes; Full shared Hover preserved. Edge check uses dispatched event; physical edge hit testing is not proved. |
| Animation states are readable and new Hover/leave cancels animation | Historical Human animation decision; interactions.json | Existing speed judgement is a reference; current runtime start/cancel checked. Do not claim temporal readability from static captures. |
| Text remains readable, unclipped and accessible at intended size | Existing Human SVG/scroll and font cases; package-smoke independent-core/core.agent.png | Directly read packaged Diamond PNG. Not universal proof for long labels, every viewport or all generated graphs. |
| Reusable delivery works outside source checkout | boundary-product-check package-smoke/manifest.json | Extracted Windows package context/finalize/verify and actual PNG conversion pass. Package predates latest Core Hover correction. |
| Decisions and evidence are preserved without conflating Agent and Human | outputs/dds-design-decisions-20261014.json; this audit | Retrospective decisions must retain their provenance. No new Human PASS inferred from tests. |

## Next execution order

Update after subsequent verification: durable browser tests now cover Core/Full focus policy, exact node/edge membership on both sides of a shared boundary, and 100%/fit scrolling through fold changes (4/4 PASS). Long-label Linear and Diamond images were directly read; the two-line preference remains unimplemented but the previously accepted one-line form is retained. Package-smoke-v2 includes the Core correction and passed extracted-package CLI plus Core/Full browser tests. Its source differs from current workflow.mjs only by subsequent end-of-file whitespace cleanup. Selected original machine-readable results and SHA-256 fingerprints are preserved in `dds-integration-evidence-20261016.json`, so those facts are not dependent on external workspace paths remaining available.

1. Add durable browser regression coverage for Core Full-only interaction policy and broader Full membership scopes, using current source rather than stale generated HTML.
2. Check remaining long-label / display-size cases against recorded Human references. Escalate genuine ambiguous differences only.
3. Refresh development package after final source changes and verify its exact manifest.
4. Preserve source and evidence in Git once author identity is configured; do not invent attribution. Release archive has pre-existing changes and must not be overwritten as a side effect.

Deeper nesting remains deferred. Unsupported multi-party identity contractions are an explicit current limitation, not a claim that all graph architectures are solved. Repository source tests, Agent IMAGE READ and Human judgements remain separate evidence classes. This audit does not redefine the Ultimate Goal as test-count completion.
