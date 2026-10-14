# Local candidate checkpoint

Author: chatgpt_gpt6
Date: 2026-10-14

This commit preserves the reviewed, previously uncommitted routing, linked diagrams, viewport and routing-safety candidate as one dependency-coupled checkpoint. It is not a release or Human UX approval. v3.92 (f9fcc8e) remains the user-selected expression baseline.

Validation on the current source: `node --test v3_8_cli/designing-relation-diagrams/test/*.test.mjs`: 119 passed, zero failed. No fresh browser or full Human workflow trial was performed for this cleanup. Git whitespace check with cr-at-eol reports four new-file blank-at-EOF warnings, including the unchanged upstream license text. These formatting warnings are retained; this is not a clean whitespace-check claim.

The v3.94/v3.95 packages and manifests are historical candidate artifacts. Current source includes subsequent routing-safety changes and is not byte-identical to the v3.95 package. No package was rebuilt. The modified v3.8 package is deliberately excluded pending provenance resolution.

Later ELK/port/diamond experiments remain outside this repository and were not adopted by this commit. Independent Core Hover removal remains pending. Do not infer arbitrary-topology or Human UX acceptance from unit-test success.
