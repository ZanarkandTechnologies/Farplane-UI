# Resource Bank

Resource Bank is Farplane's AI Pinterest for media references.

The media-first workspace renders:

- recently ingested assets
- optional source transcript plus freeform Markdown analysis
- approved Brand Kits
- a visual Brand Kit gallery and focused single-kit workspace
- extracted skill findings
- tag clusters
- retrieval handles for future creation work

The Brand Kits tab is the V1 approval surface: browse approved kits, set the
default kit in `farplane/brand.yaml`, edit one freeform master prompt, and
promote Resource Bank creative elements into Brand-Kit-owned snapshots.
Every actively written Resource Bank element is an explicitly selected reuse
candidate and therefore pinned; unselected source context remains in analysis.
Brand Kit membership means approved durable identity.

Each Brand Kit has exactly one prompt block. The prompt may include provider
hints, subtitle styling, voice direction, aspect ratio, format, and production
constraints. All approved creative elements in the kit travel with that prompt;
there is no selector or per-prompt element membership.

Creative elements use six production-owned kinds (`format`, `storyboard`,
`visual`, `character`, `audio`, and `editing`) and the same production-ready capsule in Resource Bank,
computed Tasty Packs, and Brand Kit snapshots: kind, title, description,
why-it-works reasoning, one golden example asset with an optional note, one
generation prompt, pinned state, and tags. Compact cards keep the grid scannable;
selecting one opens a scrollable right-side inspector with the full rationale,
example, prompt, provenance, and source actions. Adding an element opens a Brand
Kit picker and requires explicit confirmation. The default kit may be preselected,
but no kit mutation occurs until confirmation.

Backend data lives in `convex/modules/resourceBank`.
