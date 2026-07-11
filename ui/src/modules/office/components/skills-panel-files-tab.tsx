/**
 * SKILLS PANEL FILES TAB
 * ======================
 * Renders skill package file browsing and inline text editing.
 *
 * MEMORY REFERENCES:
 * - MEM-0166
 * - MEM-0205
 */

import type { ReactElement } from "react";
import { Response } from "@/components/ai-elements/response";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { SkillEvalSuite, SkillStudioFileContent } from "@/modules/runtime";
import { SkillEvalSuiteView } from "@/modules/skills-studio/components/skill-eval-suite-view";
import type { SkillsPanelFileState, SkillsPanelSelectionState } from "./skills-panel-types";

type Props = {
  selection: SkillsPanelSelectionState;
  fileState: SkillsPanelFileState;
  onSelectFilePath: (path: string) => void;
  onChangeFileDraft: (value: string) => void;
  onSaveFile: () => void;
};

function filePreviewKind(file: SkillStudioFileContent): "markdown" | "json" | "text" {
  const path = file.path.toLowerCase();
  if (path.endsWith(".md") || path.endsWith(".mdx")) return "markdown";
  if (path.endsWith(".json") || path.endsWith(".jsonl")) return "json";
  return "text";
}

function formatJsonPreview(content: string): string {
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content;
  }
}

function SkillFilePreview({
  file,
  content,
  evalSuite,
}: {
  file: SkillStudioFileContent;
  content: string;
  evalSuite?: SkillEvalSuite;
}): ReactElement {
  const kind = filePreviewKind(file);
  if (file.kind === "eval" && evalSuite) {
    return <SkillEvalSuiteView suite={evalSuite} path={file.path} />;
  }
  return (
    <div className="rounded-md border bg-muted/10">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{file.path}</p>
          <p className="text-xs text-muted-foreground">Skill special-file preview</p>
        </div>
        <Badge variant="secondary">{kind}</Badge>
      </div>
      <ScrollArea className="max-h-[30rem]">
        <div className="p-4">
          {kind === "markdown" ? (
            <Response className="prose prose-invert max-w-none text-sm">{content}</Response>
          ) : (
            <pre className="whitespace-pre-wrap break-words text-xs leading-6">
              {kind === "json" ? formatJsonPreview(content) : content}
            </pre>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export function SkillsPanelFilesTab({
  selection,
  fileState,
  onSelectFilePath,
  onChangeFileDraft,
  onSaveFile,
}: Props): ReactElement {
  const { selectedDetail } = selection;
  const { selectedFilePath, selectedFile, fileDraft, fileSaveStatus, isSavingFile } = fileState;

  if (!selectedDetail) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Select a runtime skill to inspect its files, diagram, demos, and controls.
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[260px_minmax(0,1fr)] gap-4">
      <ScrollArea className="h-full min-h-0 rounded-md border">
        <div className="space-y-1 p-2">
          {selectedDetail.fileEntries.map((file) => (
            <button
              key={file.path}
              type="button"
              onClick={() => onSelectFilePath(file.path)}
              className={`w-full rounded-md px-3 py-2 text-left text-sm ${selectedFilePath === file.path ? "bg-primary/10 text-primary" : "hover:bg-muted/40"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span>{file.path}</span>
                <Badge variant="outline">{file.kind}</Badge>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
      <ScrollArea className="h-full min-h-0 rounded-md border">
        <div className="min-h-full p-4">
          {!selectedFile ? (
            <p className="text-sm text-muted-foreground">Select a file to preview it.</p>
          ) : !selectedFile.isText ? (
            <p className="text-sm text-muted-foreground">
              Binary or non-text asset. Size: {selectedFile.sizeBytes ?? 0} bytes.
            </p>
          ) : selectedFile.writable === false ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                This file is read-only from the viewer.
              </p>
              <SkillFilePreview
                file={selectedFile}
                content={selectedFile.content ?? ""}
                evalSuite={selectedDetail.evalSuite}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={onSaveFile} disabled={isSavingFile}>
                  {isSavingFile ? "Saving..." : "Save file"}
                </Button>
                {fileSaveStatus ? (
                  <span className="text-xs text-muted-foreground">{fileSaveStatus}</span>
                ) : null}
              </div>
              <SkillFilePreview
                file={selectedFile}
                content={fileDraft}
                evalSuite={selectedDetail.evalSuite}
              />
              <Textarea
                className="min-h-[32rem] font-mono text-xs"
                value={fileDraft}
                onChange={(event) => onChangeFileDraft(event.target.value)}
              />
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
