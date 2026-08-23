import type { CSSProperties } from "react";

export const panelStyle: CSSProperties = {
  width: 340,
  boxSizing: "border-box",
  border: "1px solid var(--farplane-border)",
  borderLeft: "2px solid var(--farplane-primary)",
  borderRadius: 0,
  background: "var(--farplane-card)",
  color: "var(--farplane-foreground)",
  padding: 13,
  boxShadow: "none",
  fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
  letterSpacing: ".03em",
  overflowWrap: "anywhere",
};

export const closeStyle: CSSProperties = {
  marginLeft: "auto",
  border: 0,
  background: "transparent",
  color: "var(--farplane-muted-foreground)",
  padding: 2,
  cursor: "pointer",
  display: "flex",
};

export const copyStyle: CSSProperties = {
  color: "var(--farplane-muted-foreground)",
  fontSize: 11.5,
  lineHeight: 1.55,
  margin: "7px 0",
};

export const fieldLabelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  marginBottom: 11,
  color: "var(--farplane-muted-foreground)",
  font: '800 9px "JetBrains Mono", "SFMono-Regular", Consolas, monospace',
  letterSpacing: ".08em",
  textTransform: "uppercase",
};

const inputBaseStyle: CSSProperties = {
  border: "1px solid var(--farplane-border)",
  borderRadius: 0,
  background: "var(--farplane-background)",
  color: "var(--farplane-foreground)",
  boxSizing: "border-box",
  width: "100%",
  padding: "8px 9px",
  font: '600 11px/1.4 "JetBrains Mono", "SFMono-Regular", Consolas, monospace',
  letterSpacing: 0,
  outline: "none",
};

export const inputStyle: CSSProperties = { ...inputBaseStyle, height: 34 };
export const textareaStyle: CSSProperties = {
  ...inputBaseStyle,
  minHeight: 98,
  resize: "vertical",
};
export const submitStyle: CSSProperties = {
  border: "1px solid var(--farplane-primary)",
  background: "var(--farplane-primary)",
  color: "var(--farplane-primary-foreground)",
  cursor: "pointer",
  width: "100%",
  padding: "9px 10px",
  font: '900 10px "JetBrains Mono", "SFMono-Regular", Consolas, monospace',
  letterSpacing: ".08em",
  textTransform: "uppercase",
};
