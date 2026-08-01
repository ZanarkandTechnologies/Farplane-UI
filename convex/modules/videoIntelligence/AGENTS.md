# Video Intelligence Convex Module

This module owns the cloud reporting layer linked to Resource Bank video assets.

## Rules

- Resource Bank owns source assets, ingestion jobs, and retained source analysis.
- Video Intelligence owns dossiers, stories, tags, and source contributions.
- Every public mutation must validate the bridge credential in Convex; loopback origin checks are defense in depth, not the cloud trust boundary.
- Every contribution must reference one dossier and one story; every claim must retain its evidence anchor.
- Aggregate perspectives and related-story edges are query projections, not canonical tables or comparison runs.
- Existing YouTube assets without structured records must remain visible as legacy dossiers without invented claims.
- Story matching is conservative. Conflicting event dates never merge automatically.
