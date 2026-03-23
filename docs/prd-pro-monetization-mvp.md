# PRD: Pro Monetization MVP

## Problem Statement

`Send to NotebookLM` already solves the basic "send this source into NotebookLM" problem for web pages, arXiv papers, and YouTube videos. That baseline workflow is valuable, but it does not yet create a clear monetization boundary for high-frequency users.

Power users such as researchers, students, analysts, educators, and creators often repeat the same tasks:

- importing many sources in a session
- avoiding duplicate imports
- routing different source types into the right notebook
- recalling what was already imported
- applying the same post-import prompt patterns over and over

Today the extension supports one-off sending well, but high-frequency workflows still require manual repetition and memory. This creates friction precisely for the users most likely to pay.

The problem to solve is how to introduce a paid Pro tier that preserves the current extension's broad utility, while charging for workflow acceleration features that materially reduce time and mental overhead for serious NotebookLM users.

## Solution

Introduce a two-tier product:

- Free keeps the current core sending workflow intact.
- Pro unlocks workflow acceleration features for frequent users.

The first paid release will be a local-first Pro MVP with no required backend service. The user can continue using their existing NotebookLM browser session. Pro focuses on five capabilities:

1. Batch import
2. Deduplication
3. Auto-routing rules
4. Import history
5. Presets for common research and creation workflows

This release should make the product feel meaningfully more powerful for frequent users without forcing a heavy infrastructure investment or reducing the usefulness of the free product.

## User Stories

1. As a casual NotebookLM user, I want to keep sending a single page for free, so that the extension remains useful before I decide whether to pay.
2. As a student, I want to send an arXiv paper into NotebookLM in one click, so that I can quickly start studying it.
3. As a YouTube learner, I want to send a video into NotebookLM without copy-pasting URLs, so that I can capture sources with less friction.
4. As a new user, I want the free tier to feel complete for basic usage, so that I trust the product before upgrading.
5. As a high-frequency researcher, I want to import multiple open tabs in one action, so that I do not need to repeat the same send flow tab by tab.
6. As a content curator, I want to paste multiple links and import them together, so that I can process a reading list in a single workflow.
7. As a user importing several sources, I want the extension to show which sources are valid before sending, so that I can avoid failed imports.
8. As a Pro user, I want duplicate source detection, so that I do not accidentally send the same page, PDF, or video multiple times.
9. As a Pro user, I want duplicate detection to understand canonical URLs and source-specific IDs when possible, so that equivalent links are treated as the same source.
10. As a researcher, I want arXiv duplicate detection to identify the same paper across `abs` and `pdf` URLs, so that my notebooks stay clean.
11. As a video-heavy user, I want YouTube duplicate detection to identify repeated videos even if the URL shape differs, so that I avoid unnecessary clutter.
12. As a Pro user, I want the extension to warn me when a source appears to be a duplicate before importing, so that I can decide whether to continue.
13. As a Pro user, I want the option to skip duplicates automatically during batch import, so that large imports remain efficient.
14. As a Pro user, I want rules that route sources by hostname or site type, so that sources land in the right notebook automatically.
15. As a researcher, I want arXiv links to go to my papers notebook automatically, so that I do not reselect the same notebook every time.
16. As a learner, I want YouTube links to go to my lecture notebook automatically, so that I can save with one click.
17. As a Pro user, I want a rule fallback order, so that the extension behaves predictably when several rules could match.
18. As a Pro user, I want to see which rule was applied for an import, so that I can understand and trust the routing behavior.
19. As a Pro user, I want to view my recent import history, so that I can confirm what was sent and where it went.
20. As a Pro user, I want import history to include status, target notebook, source URL, and timestamp, so that I can troubleshoot or retrace past actions.
21. As a Pro user, I want failed imports to appear in history, so that I can retry or diagnose them.
22. As a Pro user, I want to retry a failed import from history when possible, so that I do not rebuild the context manually.
23. As a Pro user, I want to clear history, so that I can manage local extension storage.
24. As a Pro user, I want preset workflows such as literature review, teaching notes, and video summary, so that I can reuse my most common prompts.
25. As a Pro user, I want to choose a preset while importing or immediately after importing, so that I can move from source collection to knowledge work faster.
26. As a user with many notebooks, I want routing and presets to work together, so that imports follow my established research system.
27. As a user comparing plans, I want the app to clearly distinguish Free and Pro features, so that I understand why upgrading is worthwhile.
28. As a user who hits a Pro-only action, I want a clear upgrade explanation instead of a broken or confusing experience, so that the paywall feels fair.
29. As a product owner, I want the Pro surface area to be meaningful but limited, so that the team can ship a credible paid MVP quickly.
30. As a product owner, I want Free to remain strong enough to drive store growth and referrals, so that monetization does not suppress adoption.
31. As a product owner, I want the MVP to work without a mandatory cloud backend, so that launch complexity and support burden stay low.
32. As a developer, I want Pro entitlement checks abstracted behind a simple interface, so that the product can start local-first and later migrate to license or cloud validation.
33. As a developer, I want import logic reused across popup, inline launcher, and context menu flows, so that Pro behavior stays consistent across entry points.
34. As a developer, I want the batch import pipeline to be testable independently of the UI, so that import behavior can evolve safely.
35. As a support owner, I want clear event and error states around dedupe, routing, and history, so that support issues can be triaged quickly.

## Implementation Decisions

- The product will launch with a Free tier and a Pro tier. Free retains the current single-source send flows. Pro adds batch import, deduplication, auto-routing, import history, and presets.
- The MVP will remain local-first. No required backend is assumed for the first release. Pro entitlement should be implemented through a dedicated entitlement module so the source of truth can change later without rewriting product logic.
- Entitlement checks should be declarative and capability-based. The rest of the app should ask whether a capability is enabled instead of directly checking plan names.
- The import system should be refactored into a shared import orchestration module that normalizes sources, resolves notebook targets, applies dedupe rules, executes imports, and writes history records.
- Source normalization should produce a canonical identity used across batch import, dedupe, and history. The identity should use source-specific keys when possible, including arXiv paper ID and YouTube video ID, with canonical URL fallback for general pages.
- Batch import should accept a list of candidate sources from multiple entry points, validate them, normalize them, deduplicate within the batch, then import sequentially with per-item result reporting.
- Auto-routing should use a rule engine with a predictable precedence order. Proposed order is exact site-type rules first, hostname rules second, and fallback selected notebook last.
- Routing rules should resolve to a known notebook identifier and should expose why a notebook was selected for a given import.
- Import history should be stored locally with a bounded retention policy to protect extension storage usage. Each record should include source identity, source URL, notebook target, import status, rule match metadata, timestamps, and relevant error details.
- Presets should represent reusable workflow intents rather than raw UI strings alone. Each preset should contain a stable identifier, label, description, and associated prompt configuration or enhancer setting overrides.
- Presets should be available in the popup first. Inline launcher integration may reuse the same module but can be simplified in the first release if interaction density becomes a UI constraint.
- Free users attempting a Pro-only action should see a clear upgrade state, including what the feature does and why it is part of Pro.
- The product should not gate the current single-page sending capability, context menu basic sending, or existing quick import flows behind Pro.
- The current settings model for chat, slide deck, and infographic preferences should remain compatible. Presets should layer on top of those settings rather than replace them outright.
- The UI should introduce plan-aware surfaces in the popup and options experiences. These surfaces should show which capabilities are available, which are locked, and how a locked action can be upgraded.
- Analytics, if added later, are not required for the first implementation. The PRD assumes local behavior can ship without usage telemetry.

## Testing Decisions

- Good tests should verify user-visible behavior and durable business rules, not internal implementation details.
- The most important behavior to test is import decision making: source normalization, batch dedupe, route selection, history writing, and entitlement gating.
- The entitlement module should have behavior tests for enabled and disabled capabilities, including locked-action responses.
- The source normalization module should have behavior tests covering general web pages, arXiv `abs` and `pdf` forms, YouTube watch and short-link forms, and canonical URL fallback behavior.
- The routing engine should have behavior tests covering rule matching precedence, fallback behavior, and unmatched cases.
- The batch import orchestrator should have behavior tests for mixed valid and invalid inputs, duplicate skipping, partial failures, and history persistence.
- The history store should have behavior tests for append, retention trimming, clear, and retry metadata behavior.
- The preset layer should have behavior tests ensuring preset application modifies the effective workflow configuration without corrupting baseline settings.
- UI tests should focus on plan-aware affordances in popup and options flows, especially feature locking and upgrade messaging for Pro-only actions.
- Existing popup, inline launcher, and background integration behavior should be smoke-tested to confirm that the free sending flow remains intact after the monetization refactor.

## Out of Scope

- Team workspaces or shared routing rules
- Cloud sync of history, rules, or presets
- Server-enforced licensing or subscription billing infrastructure
- Chrome Web Store payment implementation details
- Multi-browser account sync
- Automatic post-import prompt execution inside NotebookLM
- New content-source adapters beyond small follow-up support needed for the MVP
- Full redesign of the extension UI beyond the surfaces required for plan-aware interactions
- Large-scale analytics instrumentation

## Further Notes

- The recommended pricing model for this MVP is Free plus Pro lifetime purchase, with later room for a subscription tier only if cloud-backed capabilities are introduced.
- The paid boundary should feel fair: Free solves single-source capture, while Pro sells time savings for repeated, professional use.
- The first release should optimize for a credible and understandable upgrade story rather than maximum feature breadth.
- A good rollout path is:
  1. internal implementation of shared import orchestration
  2. hidden feature flags for Pro modules
  3. UI exposure of batch import and routing
  4. import history and presets
  5. store listing and upgrade copy updates
