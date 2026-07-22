# Resource Bank

Resource Bank is Farplane's AI Pinterest for media references.

The media-first workspace renders:

- recently ingested assets
- source analysis
- approved Brand Kits
- a visual Brand Kit gallery and focused single-kit workspace
- extracted skill findings
- tag clusters
- retrieval handles for future creation work

The Brand Kits tab is the V1 approval surface: browse approved kits, set the
default kit in `farplane/brand.yaml`, edit one freeform master prompt, and
promote Resource Bank creative elements into Brand-Kit-owned snapshots.
Resource Bank `pinned` remains a retrieval preference; Brand Kit membership
means approved durable identity.

Each Brand Kit has exactly one prompt block. The prompt may include provider
hints, subtitle styling, voice direction, aspect ratio, format, and production
constraints. All approved creative elements in the kit travel with that prompt;
there is no selector or per-prompt element membership.

Creative elements use the same production-ready capsule in Resource Bank,
computed Tasty Packs, and Brand Kit snapshots: kind, title, description,
why-it-works reasoning, one golden example asset with an optional note, one
generation prompt, pinned state, and tags. Element cards lead with the selected
golden media and keep the generation prompt in a compact disclosure so the grid
stays visual and scannable.

Backend data lives in `convex/modules/resourceBank`.
