# Video Intelligence Convex Module

This module owns the cloud reporting layer linked to Resource Bank video assets.

## Rules

- Resource Bank owns source assets, ingestion jobs, and retained source analysis.
- Video Intelligence owns dossiers, stories, tags, and source contributions.
- Keep the write path consistent with Resource Bank: the origin-restricted local bridge calls ordinary Convex mutations, while browser UI remains read-only.
- Every contribution must reference one dossier and one story; every claim must retain its evidence anchor.
- Aggregate perspectives and related-story edges are query projections, not canonical tables or comparison runs.
- Existing YouTube assets without structured records must remain visible as legacy dossiers without invented claims.
- Story matching is conservative. Conflicting event dates never merge automatically.
