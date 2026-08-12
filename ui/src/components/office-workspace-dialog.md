---
kind: component-contract
status: active
project: Farplane UI
created_at: 2026-08-13
updated_at: 2026-08-13
owner: ui-platform
source_refs:
  - office-workspace-dialog.tsx
  - ../modules/content-intelligence/components/content-intelligence-panel.tsx
---

# Office Workspace Dialog

`OfficeWorkspaceDialog` is the shared, viewport-safe shell for full Office
workspaces. It supplies Radix dialog behavior, the elevated panel layer, and
the common desktop/mobile frame; it owns neither a feature's data nor its
navigation.

```ts
OfficeWorkspaceDialog(open, onOpenChange, children) -> modal workspace frame
```

## Composition contract

- The shared shell owns focus management, overlay/close behavior, z-index, and
  the constrained viewport frame.
- The feature owns its header, tabs, local state, data subscriptions, and
  exactly one active body-scroll region.
- A detail view replaces or overlays the feature body. It must preserve its
  library context rather than create a second scrolling pane behind it.
- Do not put independent vertical scrollers inside the same active workspace
  body. If a feed needs pagination, its end sentinel observes that one body.

```tsx
<OfficeWorkspaceDialog open={open} onOpenChange={setOpen}>
  <DialogHeader className="shrink-0">…</DialogHeader>
  <Tabs className="min-h-0 flex flex-1 flex-col">
    <TabsList className="shrink-0">…</TabsList>
    <div className="min-h-0 flex-1 overflow-y-auto">…</div>
  </Tabs>
</OfficeWorkspaceDialog>
```

## Non-goals

- It is not a global panel registry or a feature router.
- It does not fetch, cache, reset, or interpret feature data.
- It does not prescribe card grids, filters, timeline layout, or detail views.

## Proof

For a feature that changes this shell or its body structure, verify desktop and
narrow-viewport geometry, the close/focus path, exactly one active vertical
scroll owner, and a browser screenshot with no clipped or overlaying content.
