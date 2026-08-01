# Video Intelligence Convex Module

`videos.ts` receives writes from the origin-restricted YouTube bridge using the
same ordinary Convex function pattern as Resource Bank and Tasty Packs.
It reuses or creates the canonical Resource Bank job and asset, retains the
analysis, upserts a dossier, resolves provisional stories and tags, and replaces
the video's source contributions atomically.

`projection.ts` is the read contract for AI Office. It unions all existing
Resource Bank YouTube assets with structured Video Intelligence records. Assets
that predate this feature are returned as `RESOURCE_BANK` legacy dossiers;
structured claims and story perspectives appear only after re-analysis.

`domain.ts` contains deterministic story matching, tag normalization, aggregate
rebuilds, and conservative related-event derivation.
