"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CodexAppServerClient } from "@/modules/runtime";
import type {
  CapabilityProfileDefinition,
  CapabilityProfilesDocument,
  CodexCapabilityProfilesResponse,
} from "@/modules/runtime/lib/codex-app-server/types";

type CapabilityProfilePanelProps = {
  projectPath: string;
  open: boolean;
};

function profileIdFromLabel(label: string, profiles: Record<string, unknown>): string {
  const base =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 56) || "restricted";
  if (!(base in profiles)) return base;
  let suffix = 2;
  while (`${base}-${suffix}` in profiles) suffix += 1;
  return `${base}-${suffix}`;
}

function withCatalog(
  payload: CodexCapabilityProfilesResponse,
  catalog: { skill_ids: string[]; mcp_server_ids: string[] },
): CodexCapabilityProfilesResponse {
  return {
    ...payload,
    catalog: {
      skill_ids: [...new Set([...payload.catalog.skill_ids, ...catalog.skill_ids])].sort(),
      mcp_server_ids: [
        ...new Set([...payload.catalog.mcp_server_ids, ...catalog.mcp_server_ids]),
      ].sort(),
    },
  };
}

function toggleId(current: string[], id: string): string[] {
  return current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id].sort();
}

const EMPTY_DRAFT: CapabilityProfileDefinition = {
  label: "",
  allow: { skill_ids: [], mcp_server_ids: [] },
};

/**
 * Project-PM configuration only. A profile is a restriction policy, never an
 * avatar or persona; new work is applied only to a fresh Codex thread.
 */
export function CapabilityProfilePanel({
  projectPath,
  open,
}: CapabilityProfilePanelProps): React.JSX.Element | null {
  const [payload, setPayload] = useState<CodexCapabilityProfilesResponse | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingRef, setEditingRef] = useState("new");
  const [draft, setDraft] = useState<CapabilityProfileDefinition>(EMPTY_DRAFT);

  useEffect(() => {
    if (!open || !projectPath) return;
    const controller = new AbortController();
    const client = new CodexAppServerClient({ stateUrl: "" });
    setError("");
    setPayload(null);
    const runtimeCatalog = Promise.allSettled([
      client.listSkills(projectPath),
      client.listMcpServerIds(),
    ]);
    void client
      .readCapabilityProfiles(projectPath)
      .then((policy) => {
        if (controller.signal.aborted) return;
        setPayload(policy);
        const activeRef = policy.documents.project.document.active_profile_ref ?? "";
        if (activeRef.startsWith("project:")) {
          const profile =
            policy.documents.project.document.profiles[activeRef.slice("project:".length)];
          if (profile) {
            setEditingRef(activeRef);
            setDraft(profile);
          } else {
            setEditingRef("new");
            setDraft(EMPTY_DRAFT);
          }
        } else {
          setEditingRef("new");
          setDraft(EMPTY_DRAFT);
        }

        void runtimeCatalog.then((catalogResults) => {
          if (controller.signal.aborted) return;
          const skillsResponse =
            catalogResults[0].status === "fulfilled" ? catalogResults[0].value : null;
          const skillEntry =
            skillsResponse?.data.find((entry) => entry.cwd === projectPath) ??
            (skillsResponse?.data.length === 1 ? skillsResponse.data[0] : undefined);
          const mcpServerIds =
            catalogResults[1].status === "fulfilled" ? catalogResults[1].value : [];
          setPayload((current) =>
            current
              ? withCatalog(current, {
                  skill_ids:
                    skillEntry?.errors.length === 0
                      ? skillEntry.skills.map((skill) => skill.name)
                      : [],
                  mcp_server_ids: mcpServerIds,
                })
              : current,
          );
        });
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "Could not load access profiles.");
        }
      });
    return () => controller.abort();
  }, [open, projectPath]);

  const options = useMemo(() => {
    if (!payload) return [];
    return [
      ...Object.entries(payload.documents.global.document.profiles).map(([id, profile]) => ({
        ref: `global:${id}`,
        label: profile.label,
      })),
      ...Object.entries(payload.documents.project.document.profiles).map(([id, profile]) => ({
        ref: `project:${id}`,
        label: profile.label,
      })),
    ];
  }, [payload]);

  if (!projectPath) return null;

  const saveProjectDocument = async (document: CapabilityProfilesDocument): Promise<boolean> => {
    setSaving(true);
    setError("");
    try {
      const client = new CodexAppServerClient({ stateUrl: "" });
      const next = await client.writeCapabilityProfiles({
        projectPath,
        scope: "project",
        document,
      });
      setPayload(payload ? withCatalog(next, payload.catalog) : next);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save access profile.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const activeRef = payload?.documents.project.document.active_profile_ref ?? "";
  const activeProfile = payload?.active_profile;
  const projectProfiles = payload?.documents.project.document.profiles ?? {};

  const selectEditorProfile = (ref: string): void => {
    setEditingRef(ref);
    if (ref === "new") {
      setDraft(EMPTY_DRAFT);
      return;
    }
    const profile = projectProfiles[ref.slice("project:".length)];
    setDraft(profile ?? EMPTY_DRAFT);
  };

  return (
    <section
      aria-label="Project PM access profile"
      className="mt-3 rounded-lg border border-border/70 bg-background/70 p-3"
      data-testid="capability-profile-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Project PM access</p>
          <p className="text-xs text-muted-foreground">Applies to new project threads only.</p>
        </div>
        {activeProfile ? (
          <Badge data-testid="manage-agent-capability-profile-pill" variant="outline">
            Access profile · {activeProfile.label}
          </Badge>
        ) : (
          <Badge data-testid="manage-agent-full-access-pill" variant="secondary">
            Full access
          </Badge>
        )}
      </div>

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      {!payload ? (
        <p className="mt-2 text-xs text-muted-foreground">Loading access policy…</p>
      ) : null}
      {payload ? (
        <>
          <label className="mt-3 grid gap-1 text-xs font-medium">
            Equipped profile
            <select
              className="h-8 rounded-md border bg-background px-2 text-sm"
              value={activeRef}
              disabled={saving}
              onChange={(event) => {
                void saveProjectDocument({
                  ...payload.documents.project.document,
                  active_profile_ref: event.target.value || null,
                });
              }}
            >
              <option value="">Full access</option>
              {options.map((option) => (
                <option key={option.ref} value={option.ref}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <details className="mt-3 rounded-md border border-dashed p-2">
            <summary className="cursor-pointer text-xs font-medium">
              Manage project profiles
            </summary>
            <label className="mt-3 grid gap-1 text-xs font-medium">
              Profile to edit
              <select
                className="h-8 rounded-md border bg-background px-2 text-sm"
                value={editingRef}
                disabled={saving}
                onChange={(event) => selectEditorProfile(event.target.value)}
              >
                <option value="new">New profile</option>
                {Object.entries(projectProfiles).map(([id, profile]) => (
                  <option key={id} value={`project:${id}`}>
                    {profile.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 grid gap-1 text-xs font-medium">
              Profile label
              <input
                className="h-8 rounded-md border bg-background px-2 text-sm"
                value={draft.label}
                maxLength={80}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, label: event.target.value }))
                }
              />
            </label>
            <CapabilityChecklist
              title="Skills"
              values={payload.catalog.skill_ids}
              selected={draft.allow.skill_ids}
              onToggle={(id) =>
                setDraft((current) => ({
                  ...current,
                  allow: {
                    ...current.allow,
                    skill_ids: toggleId(current.allow.skill_ids, id),
                  },
                }))
              }
            />
            <CapabilityChecklist
              title="MCP servers"
              values={payload.catalog.mcp_server_ids}
              selected={draft.allow.mcp_server_ids}
              onToggle={(id) =>
                setDraft((current) => ({
                  ...current,
                  allow: {
                    ...current.allow,
                    mcp_server_ids: toggleId(current.allow.mcp_server_ids, id),
                  },
                }))
              }
            />
            <Button
              className="mt-3"
              size="sm"
              disabled={saving || !draft.label.trim()}
              onClick={() => {
                const isNew = editingRef === "new";
                const id = isNew
                  ? profileIdFromLabel(draft.label, projectProfiles)
                  : editingRef.slice("project:".length);
                const nextRef = `project:${id}`;
                void saveProjectDocument({
                  ...payload.documents.project.document,
                  profiles: {
                    ...projectProfiles,
                    [id]: {
                      ...draft,
                      label: draft.label.trim(),
                    },
                  },
                  active_profile_ref: isNew ? nextRef : activeRef || null,
                }).then((saved) => {
                  if (saved && isNew) setEditingRef(nextRef);
                });
              }}
            >
              {saving ? "Saving…" : editingRef === "new" ? "Create and equip" : "Save changes"}
            </Button>
          </details>
        </>
      ) : null}
    </section>
  );
}

function CapabilityChecklist({
  title,
  values,
  selected,
  onToggle,
}: {
  title: string;
  values: string[];
  selected: string[];
  onToggle: (id: string) => void;
}): React.JSX.Element {
  return (
    <fieldset className="mt-3">
      <legend className="text-xs font-medium">{title}</legend>
      <div className="mt-1 grid max-h-32 grid-cols-2 gap-x-3 gap-y-1 overflow-y-auto rounded border p-2 text-xs">
        {values.map((id) => (
          <label key={id} className="flex min-w-0 items-center gap-1.5">
            <input checked={selected.includes(id)} type="checkbox" onChange={() => onToggle(id)} />
            <span className="truncate">{id}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
