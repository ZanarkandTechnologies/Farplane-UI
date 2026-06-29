import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";

export function SourceBadge({
  label,
  state,
}: {
  label: string;
  state: "ready" | "partial" | "missing";
}): ReactElement {
  const variant =
    state === "missing" ? "destructive" : state === "partial" ? "secondary" : "outline";
  return (
    <Badge variant={variant} className="rounded-md">
      {label}
    </Badge>
  );
}
