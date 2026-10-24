# Validation scope and reruns

Every pull request and main push runs the scope-policy tests and workflow formatting checks.
The workflow compares the exact base and head commit SHAs using a complete NUL-delimited Git diff.
It never relies on a truncated API list or commit-message hints.

| Change                                                                                             | Browser validation                                            |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Documentation or the CI planner/workflow only                                                      | Policy tests and workflow formatting; no product browser jobs |
| Explicitly allowlisted artwork guide, related presentation, isolated listing styles or guide pages | Interface group in Chromium, Firefox and WebKit               |
| Editor, catalog, shared layout, global styles, dependencies, security or any unclassified path     | All seven groups in all three engines                         |
| Manual run, missing commit, empty/invalid diff or a runtime deletion/type change                   | All seven groups in all three engines                         |

The interface group includes the original search, category, header, artwork-details,
related, sharing, general site, refinement and content browser commands. It still runs
formatting, type checks, a clean build, all unit tests and production CDN/header checks.
Catalog and editor changes keep every existing download and export check. The 550 seasonal artwork export cases are partitioned into three disjoint groups of 184, 183 and 183 targets. The exact same per-artwork assertions run in every engine; the partition tests require complete coverage with no duplicates. Invalid or empty partitions fail. Other export groups retain their original target lists.

This is a conservative allowlist. Before adding a file to the smaller scope, inspect
its consumers and add policy regression tests. An unknown file always receives the full suite.
The manual **Run workflow** button always requests full validation.

The stable `validate (chromium)`, `validate (firefox)` and `validate (webkit)` checks
remain present. They fail if the planner fails, a selected browser group fails, or an
unexpected skip occurs. A browser skip is accepted only after a successful explicit
no-product-change plan.

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
