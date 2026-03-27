# Upstream Review Log

## Purpose

Use this file to track repeated fork-vs-upstream review work against `https://github.com/towfiqi/serpbear.git`.

The fork stays diverged from upstream, so old upstream-only commits can keep appearing in compare output even after we manually port their fixes locally. Before starting a new upstream audit, read this file and skip commits already reviewed here unless the task explicitly asks to re-check them.

## Standard Review Task

When re-running the upstream review process:

1. Compare our branch against upstream `towfiqi/serpbear` `main`.
2. List upstream-only commits that are newer than the last processed upstream commit recorded below.
3. For each new upstream commit, determine:
   - what bug or behavior it fixes
   - whether the same problem still exists locally
   - whether we should adopt the fix directly, adapt it, or skip it
4. If fixes are needed, implement them locally, run `npm run lint`, `npm run test:ci`, and `npm run build`, then commit each meaningful chunk.
5. Update this file with the new processed boundary and the local commits that adopted the work.

## Last Completed Review

- Review date: `2026-03-27`
- Upstream repo: `towfiqi/serpbear`
- Local repo at review time: `gigerIT/serpbear`
- Last processed upstream commit: `32204ee044e499590aecd0e2e244c018fb8fc8a3` (`chore(release): 3.1.0`)

## Processed Boundary Rule

For normal upstream audits, treat every upstream commit at or before `32204ee044e499590aecd0e2e244c018fb8fc8a3` as already reviewed for this fork.

Only look at commits newer than that boundary unless the task explicitly asks for a full re-review.

## Local Adoption Result

The review above was already applied locally through these commits:

- `c967aef` `fix: harden cron runtime URL handling`
- `0f4574c` `fix: harden scraper result handling`
- `03224c2` `feat: add domain subdomain matching`
- `0893a1b` `docs: update maintainer workflow notes`

## Notes For Future Runs

- Start reviewing from upstream commits after `32204ee044e499590aecd0e2e244c018fb8fc8a3`.
- Do not assume an upstream-only commit means the bug still exists locally; this fork may already have an equivalent local fix.
- If a future run ports new upstream work, append a new review section rather than overwriting this one.
