import type { ReactElement } from "react";
import type { StatePanelProps } from "./types";

export function StatePanel(props: StatePanelProps): ReactElement {
  return (
    <div
      aria-live="polite"
      className="flex h-full min-h-72 w-full flex-1 items-center justify-center p-4"
    >
      <div className="max-w-md border bg-card px-5 py-5 text-center shadow-sm">
        <div className="mx-auto flex size-10 items-center justify-center border bg-background text-muted-foreground">
          {props.icon}
        </div>
        <div className="mt-3 text-sm font-semibold">{props.title}</div>
        <div className="mt-1 text-xs leading-5 text-muted-foreground">{props.detail}</div>
        {props.action ? <div className="mt-4">{props.action}</div> : null}
      </div>
    </div>
  );
}
