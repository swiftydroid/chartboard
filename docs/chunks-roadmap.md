# ChartBoard — Chunk Roadmap

Tracks implementation chunks and their status. Chunk boundaries below are inferred from `docs/prd.md` and dependency order (chunk 1's design doc forward-referenced "chunk 9" for admin tooling, which anchors the numbering) — not a pre-existing plan, so renumber/re-split as needed when scoping a new chunk.

Each chunk gets a design doc in `docs/specs/` and an implementation plan in `docs/impl-plans/` before work starts.

| # | Chunk | PRD ref | Status | Design doc | Impl plan |
|---|-------|---------|--------|-------------|-----------|
| 1 | Auth & Access Foundation | §6.4, §4 | ✅ Done | [auth-access-foundation-design.md](specs/auth-access-foundation-design.md) | [auth-access-foundation-plan.md](impl-plans/auth-access-foundation-plan.md) |
| 2 | CI/CD Pipeline | §9 (infra) | ✅ Done | [ci-cd-pipeline-design.md](specs/ci-cd-pipeline-design.md) | [ci-cd-pipeline-plan.md](impl-plans/ci-cd-pipeline-plan.md) |
| 3 | Chord Chart Management (core CRUD, ChordPro editor, paste-and-fix) | §6.1 | Design approved | [chord-chart-management-design.md](specs/chord-chart-management-design.md) | — |
| 4 | Transpose & Version History | §6.1 | Not started | — | — |
| 5 | Annotations / private highlighting | §6.1 | Not started | — | — |
| 6 | Setlists (build, reorder, remove, delete, share) | §6.2 | Not started | — | — |
| 7 | Performance Mode (distraction-free view, chord toggle, auto-scroll) | §6.3 | Not started | — | — |
| 8 | Performance Mode: quick-access transpose | §6.3 | Not started | — | — |
| 9 | Admin Tooling (invite emails, delete-any, account lockout) | §6.4 | Not started | — | — |

## Notes

- UI/UX is not a separate chunk — each chunk builds its UI on the shared Tailwind + shadcn/ui system established in chunk 1. Performance Mode (chunk 7) is the one chunk whose design doc should explicitly address UX/readability constraints (large text, one-handed/stage use), since it's more than boilerplate CRUD UI.
- Chunks 3–5 and 7–8 split PRD §6.1 and §6.3 into smaller reviewable units, matching how chunk 1 was scoped tightly. Merge them back into fewer, larger chunks if that granularity proves unnecessary once chunk 3 scoping starts.
- `docs/specs/preLaunchChecklist.md` tracks cross-chunk deferred items (prod-parity gaps, parked findings) separately from this per-chunk status table.
