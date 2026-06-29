import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UI_Z } from "@/lib/z-index";
import { type PanelTask, PRIORITY_COLORS } from "./team-panel-types";

type TicketMarkdownDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  task: PanelTask;
  ticketBodyMarkdown: string;
  ticketFrontMatterEntries: Array<{ label: string; value: string }>;
  ticketMarkdown: string;
};

export function TicketMarkdownDialog({
  isOpen,
  onClose,
  task,
  ticketBodyMarkdown,
  ticketFrontMatterEntries,
  ticketMarkdown,
}: TicketMarkdownDialogProps): ReactElement {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="flex h-[min(92vh,940px)] w-[min(calc(100vw-2rem),700px)] max-w-[min(calc(100vw-2rem),700px)] flex-col gap-0 overflow-hidden border border-border bg-background p-0 sm:max-w-[min(calc(100vw-2rem),700px)] lg:w-[min(50vw,700px)] lg:max-w-[min(50vw,700px)]"
        style={{ zIndex: UI_Z.panelModal }}
        overlayStyle={{ zIndex: UI_Z.panelModal - 1 }}
      >
        <DialogHeader className="border-b border-border bg-card px-6 py-5">
          <DialogTitle className="min-w-0 break-words text-left text-lg [overflow-wrap:anywhere]">
            {task.title}
          </DialogTitle>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="rounded-none">
              {task.status.replace(/_/g, " ")}
            </Badge>
            <Badge
              variant="outline"
              className={`rounded-none shadow-none ${PRIORITY_COLORS[task.priority]}`}
            >
              {task.priority}
            </Badge>
            {task.artefactPath ? (
              <span className="break-words [overflow-wrap:anywhere]">{task.artefactPath}</span>
            ) : null}
          </div>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1 overflow-x-hidden">
          <div className="max-w-full space-y-4 p-6">
            <details className="rounded-md border bg-muted/10">
              <summary className="cursor-pointer px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Frontmatter ({ticketFrontMatterEntries.length})
              </summary>
              <div className="grid grid-cols-1 gap-2 border-t border-border p-3 md:grid-cols-2 xl:grid-cols-4">
                {ticketFrontMatterEntries.map((entry) => (
                  <div key={entry.label} className="rounded-md border bg-background p-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {entry.label}
                    </p>
                    <p className="mt-1 break-words text-xs text-foreground [overflow-wrap:anywhere]">
                      {entry.value}
                    </p>
                  </div>
                ))}
                {ticketFrontMatterEntries.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No frontmatter found.</p>
                ) : null}
              </div>
            </details>

            <pre className="max-w-full whitespace-pre-wrap break-words text-[13px] leading-6 text-foreground [overflow-wrap:anywhere] [word-break:break-word]">
              {ticketBodyMarkdown || ticketMarkdown}
            </pre>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
