# Reuse Taxonomy

Use this taxonomy to make saved inspiration searchable by future creator
skills. Prefer concrete tags and reusable levers over generic taste words.

## Analysis Facets

Each saved reference should answer:

- `what_it_is`: the source format and visible subject.
- `why_it_works`: the first 0-3s hook, contrast, novelty, emotional promise,
  craft move, character/persona, or audience fit.
- `retention_beats`: what makes the viewer stay after the first few seconds.
- `reusable_levers`: the repeatable parts that can inspire new work.
- `reusable_elements`: first-class candidates such as style, layout, segment,
  asset, pattern, recipe, or remix constraint.
- `asset_recipe`: what assets a future agent would need to recreate the
  pattern.
- `character_recipe`: the reusable persona/archetype/host/guide role when a
  distinctive character carries the idea.
- `prompt_guess`: a compact generation or editing prompt when useful.
- `remix_constraints`: what to avoid copying literally.
- `best_for`: future project, content type, campaign, product surface, or vibe.

## Retrieval Facets

Use fields, not tags, when the operator is likely to fetch Tasty Packs by the
facet:

- `outputTypes`: `reel`, `short-video`, `landing-page`, `thumbnail`, `ad`.
- `audiences`: `founders`, `operators`, `students`, `creators`, `buyers`.
- `ageRanges`: `18-24`, `25-34`, `35-44`.
- `industries`: `ai`, `saas`, `education`, `finance`, `creator-economy`.
- `customerRoles`: `founder`, `marketer`, `engineer`, `creator`, `buyer`.
- `tastinessScore`: optional relative value signal when the operator or agent
  can rank how useful the source is.

These fields exist to answer "what did I save recently for this audience or
idea?" quickly.

## Tag Buckets

Use tags for lightweight recall and creative language. Do not maintain a large
taxonomy for hook/open-loop/pacing/retention mechanics; those belong in
analysis text for the AI to synthesize.

Use a mix of these buckets when evidence supports them:

- Intent: `future-video`, `reuse-bg`, `thumbnail-idea`, `landing-page-inspo`,
  `visual-reference`, `copy-reference`, `editing-reference`.
- Format: `short-form-video`, `carousel`, `2x2-grid`, `talking-head-overlay`,
  `screen-recording`, `caption-bar`, `meme-format`, `collage`, `packshot`.
- Subject: `academic-chaos`, `startup`, `ai-agent`, `fashion`, `fitness`,
  `finance`, `design-world`, `creator-workflow`.
- Craft: `high-contrast-copy`, `dense-background`, `human-focal-point`,
  `bold-subtitle`, `lofi-texture`, `ui-screenshot`, `before-after`.
- Retrieval: project name, campaign name, client/product, output type, or
  platform.

## Reusable Lever Shape

Write reusable levers as action-ready phrases:

```text
- Build a 2x2 collage from four thematically related chaos/study images.
- Put a centered vertical face cutout over the grid to create a human anchor.
- Use black caption bars with white/yellow text for instant mobile legibility.
- Keep the copied idea at the composition/pacing level, not creator identity.
```

## Reusable Element Kinds

- `style`: "high-contrast lo-fi academic chaos with handheld phone energy."
- `layout`: "2x2 background grid with centered vertical talking-head overlay."
- `segment`: "first 3 seconds, before the talking-head zoom."
- `asset`: "messy desk background, black caption bar, yellow subtitle strip."
- `pattern`: "contrarian claim over visual proof collage."
- `recipe`: "generate four study-chaos panels, crop to 9:16 grid, overlay face."
- `character`: "deadpan legacy-office guide who makes the AI product premise
  feel familiar and absurdly credible."
- `constraint`: "do not copy the creator identity, exact caption, or source
  frames; reuse the composition pattern."

Use `character` for distinctive personas, archetypes, guides, hosts, mascots, or
recurring figures when that role is part of why the reference is useful. Capture
the reusable function: attitude, role in the story, contrast with the product,
audience signal, performance style, and how future work can remix the archetype.
If the source character is a real person, protected fictional character, brand
mascot, or otherwise recognizable identity, add rights-safe constraints that
avoid likeness, name, voice, catchphrases, exact costume, and direct continuity.

## Future Retrieval Query Shape

Future creation skills should query by:

```text
create_tasty_pack(idea?, timeframe?, audience?, industry?, outputType?, tags?, count?)
  -> captures[source + analysis + elements] + warnings
```

Pinned elements are the primary taste signal because they are grounded in the
operator note. Future creation skills should focus more on pinned elements and
treat unpinned elements as context.

Example retrieval requests:

- "top 5 recent references for a 2x2 video collage background"
- "best saved caption-bar short-form video examples for AI agent content"
- "visual references tagged reusable-bg and academic-chaos"
- "inspiration for making a talking-head video feel current and punchy"
