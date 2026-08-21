/**
 * Read-only inspector for Farplane-owned studio hosts.
 * It resolves the tracked call identity for a facility host; it is unrelated to
 * Project PM capability profiles, which only restrict skills and MCP servers.
 */
import { Eye, LoaderCircle, MessageSquare, Mic2, Phone, Sparkles } from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UI_Z } from "@/lib/z-index";
import { useChatActions } from "@/modules/chat";
import type { EmployeeData } from "@/modules/office/lib/types";
import { AgentFace } from "@/modules/realtime-call/components/agent-face";
import { useProjectAgentProfiles } from "@/modules/realtime-call/hooks/use-project-agent-profiles";
import { useRealtimeCallStore } from "@/modules/realtime-call/store";

export function ExecutiveAgentProfileDialog({
  employee,
  open,
  onOpenChange,
}: {
  employee: EmployeeData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): ReactElement {
  const agentId = String(employee._id).replace(/^employee-/, "");
  const profileQuery = useProjectAgentProfiles(null, open, "office");
  const profile = profileQuery.data?.profiles[agentId];
  const openCall = useRealtimeCallStore((state) => state.openCall);
  const { openEmployeeChat } = useChatActions();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" style={{ zIndex: UI_Z.panelElevated }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="size-5" aria-hidden="true" /> View Studio Host
          </DialogTitle>
          <DialogDescription>Facility call identity, not an access profile.</DialogDescription>
        </DialogHeader>

        {profileQuery.isLoading ? (
          <div className="flex min-h-72 items-center justify-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" /> Loading
            studio host…
          </div>
        ) : profile ? (
          <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
            <div className="rounded-xl border bg-muted/25 p-4">
              <AgentFace profile={profile} className="mx-auto size-36 drop-shadow-xl" />
              <div className="mt-3 text-center">
                <h3 className="font-semibold">{profile.name}</h3>
                <p className="text-xs text-muted-foreground">{profile.title}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge data-testid="manage-studio-host-pill" variant="outline" className="gap-1">
                  <Sparkles className="size-3" aria-hidden="true" /> Studio host · {profile.name}
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="size-3" aria-hidden="true" /> Local override
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Mic2 className="size-3" aria-hidden="true" /> Live voice
                </Badge>
                <Badge variant="outline">Name-gated in group calls</Badge>
              </div>

              <p className="text-sm leading-6 text-muted-foreground">{profile.background}</p>

              <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 rounded-lg border p-3 text-sm">
                <dt className="text-muted-foreground">Agent ID</dt>
                <dd className="truncate font-mono text-xs">{profile.agentId}</dd>
                <dt className="text-muted-foreground">Voice</dt>
                <dd>{profile.voice?.voiceId ?? "Not configured"}</dd>
                <dt className="text-muted-foreground">Model</dt>
                <dd className="truncate">{profile.voice?.model ?? "Not configured"}</dd>
                <dt className="text-muted-foreground">Vision</dt>
                <dd>{profile.vision?.mode === "turn_snapshot" ? "Turn snapshot" : "Off"}</dd>
                <dt className="text-muted-foreground">Call behavior</dt>
                <dd>Say “{profile.name}” to activate in a group call.</dd>
              </dl>
            </div>
          </div>
        ) : (
          <div role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm">
            {profileQuery.error || `No tracked profile exists for ${agentId}.`}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            variant="secondary"
            disabled={!profile}
            onClick={() => {
              onOpenChange(false);
              void openEmployeeChat(String(employee._id), true, profile?.name || employee.name);
            }}
          >
            <MessageSquare className="size-4" aria-hidden="true" /> Chat{" "}
            {profile?.name || employee.name}
          </Button>
          <Button
            disabled={!profile}
            onClick={() => {
              onOpenChange(false);
              openCall([String(employee._id)]);
            }}
          >
            <Phone className="size-4" aria-hidden="true" /> Call {profile?.name || employee.name}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
