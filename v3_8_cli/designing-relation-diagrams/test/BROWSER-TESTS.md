# Browser interaction regression

Run `node --test test/interaction-policy.browser.mjs` from the skill source directory.

Install Playwright and its Chromium runtime in the test environment, or set `DRD_PLAYWRIGHT_MODULE` to an available Playwright module and `DRD_CAPTURE_CHANNEL` to an installed channel such as `msedge`. No machine-specific path is embedded in the test. Missing browser prerequisites fail visibly; this separate browser suite is not included by the ordinary `test/*.test.mjs` glob.

The test renders HTML using current repository modules in a fresh temporary directory. It checks Core/Full runtime types, collapsed and expanded node Hover, input token start, mouse leave cleanup, edge focus/blur events, and folding round-trip. Edge focus events are dispatched: physical edge pointer hit testing is a separate concern. This suite proves interaction policy, not Human readability or animation pacing.

The Full membership test additionally checks both unique Processes and their shared Entity. Expected node and edge memberships are specified independently of the runtime scope implementation. Shared Hover activates the union, while each unique Process activates only its own Core plus relevant outer E2E nodes; intervening edges belonging to the other Core remain dimmed.

Set `DRD_TEST_RENDER_MODULE` to an extracted package's absolute `scripts/lib/render.mjs` path to run the same suite against that package instead of repository source.

2026-10-16 Windows Edge run: 4/4 tests pass, zero skipped. The earlier regression was independently reproduced before the fix in `outputs/dds-boundary-product-check-20261016/core-hover-before/browser-check.json` under the development workspace.

The size-control test uses a 400x360 viewport: 100% keeps SVG scale at 1 across expand/collapse, the output is reachable within the host through scrolling, and whole-fit restores reduced scale and scroll origin. These are geometry/interaction assertions, not text readability judgements.
