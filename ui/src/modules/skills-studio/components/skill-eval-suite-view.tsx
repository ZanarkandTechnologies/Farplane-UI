"use client";

/**
 * Canonical portable Agent Skills eval suite renderer.
 * Inputs are already validated by the Skill Studio state bridge; this view never interprets
 * runner-native harness task aliases or legacy skill-local fields.
 */

import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import type { SkillEvalCase, SkillEvalFarplaneMetadata, SkillEvalSuite } from "@/modules/runtime";

function MetadataValues({
  metadata,
}: {
  metadata?: SkillEvalFarplaneMetadata;
}): ReactElement | null {
  if (!metadata) return null;
  const details = [
    ["Context", metadata.context],
    ["Notes", metadata.notes],
    ["Feature ID", metadata.feature_id],
    ["Workspace fixture", metadata.workspace_fixture],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  if (!metadata.tags?.length && !details.length) return null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {metadata.tags?.map((tag) => (
          <Badge key={tag} variant="outline">
            {tag}
          </Badge>
        ))}
      </div>
      {details.map(([label, value]) => (
        <div key={label}>
          <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{value}</p>
        </div>
      ))}
    </div>
  );
}

function EvalCaseView({ evalCase }: { evalCase: SkillEvalCase }): ReactElement {
  const metadata = evalCase.metadata?.farplane;
  return (
    <article className="space-y-4 rounded-md border bg-background p-4">
      <div>
        <p className="text-xs font-mono text-muted-foreground">{evalCase.id}</p>
        <h4 className="mt-1 text-base font-semibold">{metadata?.title ?? evalCase.id}</h4>
      </div>
      <MetadataValues metadata={metadata} />
      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground">Prompt</p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{evalCase.prompt}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground">Expected output</p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{evalCase.expected_output}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Files</p>
          {evalCase.files.length ? (
            <ul className="mt-1 space-y-1 font-mono text-xs">
              {evalCase.files.map((file) => (
                <li key={file}>{file}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">No input files.</p>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Assertions</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {evalCase.assertions.map((assertion) => (
              <li key={assertion}>{assertion}</li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}

export function SkillEvalSuiteView({
  suite,
  path,
}: {
  suite: SkillEvalSuite;
  path: string;
}): ReactElement {
  return (
    <div className="rounded-md border bg-muted/10">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <p className="text-sm font-medium">{suite.skill_name}</p>
          <p className="text-xs text-muted-foreground">{path}</p>
        </div>
        <Badge variant="secondary">{suite.evals.length} evals</Badge>
      </div>
      <div className="space-y-4 p-4">
        {suite.evals.map((evalCase) => (
          <EvalCaseView key={evalCase.id} evalCase={evalCase} />
        ))}
      </div>
    </div>
  );
}
