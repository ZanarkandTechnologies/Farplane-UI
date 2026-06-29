import { BookOpen, FileText } from "lucide-react";
import type { ReactElement } from "react";
import { Response } from "@/components/ai-elements/response";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { IntelligenceTabProps } from "./types";

export function DocsTab({ project, memoryRows }: IntelligenceTabProps): ReactElement {
  const docs = memoryRows.length > 0 ? memoryRows : [];
  const activeDoc = docs[0] ?? null;

  return (
    <div className="grid h-full grid-cols-1 gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="h-full rounded-md">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <BookOpen className="h-4 w-4 text-primary" />
            Files / Docs
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-[calc(100%-3rem)] min-h-0 flex-col gap-3">
          <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
            <p>Project: {project?.name ?? "none"}</p>
            <p className="break-all">Path: {project?.trackingContext ?? "not set"}</p>
          </div>
          <ScrollArea className="min-h-0 flex-1 pr-3">
            <div className="space-y-2">
              {docs.map((doc) => (
                <div key={doc.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{doc.title ?? doc.sourcePath ?? doc.id}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {doc.sourcePath ?? "memory source"}
                  </p>
                </div>
              ))}
              {docs.length === 0 ? (
                <p className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                  No docs loaded yet. Generated files will appear here when project memory indexes
                  them.
                </p>
              ) : null}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="h-full rounded-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{activeDoc?.title ?? "Project Docs Preview"}</CardTitle>
        </CardHeader>
        <CardContent className="h-[calc(100%-3rem)] min-h-0">
          <ScrollArea className="h-full rounded-md border p-4">
            {activeDoc ? (
              <Response className="prose prose-sm max-w-none dark:prose-invert">
                {activeDoc.body}
              </Response>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a project memory/doc source after files load.
              </p>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
