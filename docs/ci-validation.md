# Validation scope and reruns

Every pull request and main push runs the scope-policy tests and workflow formatting checks.
The workflow compares the exact base and head commit SHAs using a complete NUL-delimited Git diff.
It never relies on a truncated API list or commit-message hints.

| Change                                                                                             | Browser validation                                            |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Documentation or the CI planner/workflow only                                                      | Policy tests and workflow formatting; no product browser jobs |
| Explicitly allowlisted artwork guide, related presentation, isolated listing styles or guide pages | All three interface groups in Chromium, Firefox and WebKit    |
| Editor, catalog, shared layout, global styles, dependencies, security or any unclassified path     | All thirteen groups in all three engines                      |
| Manual run, missing commit, empty/invalid diff or a runtime deletion/type change                   | All thirteen groups in all three engines                      |

The interface groups include the original search, category, header, artwork-details,
related, sharing, general site, refinement and content browser commands. Splitting the
long WebKit sequence and the catalog-extra exports keeps the work bounded without
omitting cases. Each browser group builds its own clean artifact and runs its
selected interaction checks. Formatting, type checks, a normal build and all Node
unit tests run once in the shared source job. The production job independently
builds with the verified CDN mapping and runs the catalog, CSP, publication and
retired-route checks. Both jobs use the same pinned container and Node version as
the browsers and remain mandatory dependencies of every final validation gate.

Catalog and editor changes keep every existing download and export check. All
eligible original-plan seasonal artworks are partitioned into three disjoint
groups. Every subject representative, every PDF with less than 5 KB of remaining
headroom, and the largest PDF are retained in two separate representative groups.
The exact same per-artwork assertions run in each engine. Partition tests require
complete coverage with no duplicates; invalid or empty partitions fail. Labubu,
tablet, speaker and replacement checks keep their complete target lists in their
existing group. Target counts follow the current catalog rather than a fixed
historical count.

This is a conservative allowlist. Before adding a file to the smaller scope, inspect
its consumers and add policy regression tests. An unknown file always receives the full suite.
The manual **Run workflow** button always requests full validation.

The stable `validate (chromium)`, `validate (firefox)` and `validate (webkit)` checks
remain present. They fail if the planner, shared source job, production job or any
selected browser group fails. Skips are accepted only when a successful explicit
no-product-change plan skips all three product-validation stages.

## Avoid repeating successful jobs

For a transient failure on the **same commit**, GitHub Actions **Re-run failed jobs**
preserves the successful jobs from that run. A source correction creates a new commit;
the planner selects checks for its complete PR diff. Do not claim a previous commit's
passing result validates newly changed code.

Keep the current release candidate unchanged while its full validation runs. Prepare
unrelated workflow improvements on a separate branch. Cloudflare publication integrity,
asset checksums and the final production smoke checks are independent gates and remain required.

Elapsed time depends on queue availability, cache state, catalog size and the affected scope;
this policy reduces unnecessary work rather than promising a fixed deployment duration.

New commits to the same pull request supersede and cancel the earlier PR candidate, so outdated browser jobs do not block its current checks. Main-branch publications still complete their browser matrices. No suite or validation gate is removed. Board, download-page and footer regressions run in all three browser engines with their corresponding interface groups.

Evidence uploads and final validation gates use `!cancelled()` rather than `always()`: a deliberately cancelled old candidate releases queued finalizers. Actual failures still upload reports and reach the unchanged strict validation gate. A cancelled candidate cannot provide a successful current-head validation.
