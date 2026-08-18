"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { type PropsWithChildren, useEffect } from "react";
import {
  DEFAULT_FARPLANE_THEME,
  FARPLANE_THEME_BROWSER_COLORS,
  FARPLANE_THEME_STORAGE_KEY,
  resolveFarplaneTheme,
} from "@/config/theme-system";

function ThemeDocumentBridge() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const color = FARPLANE_THEME_BROWSER_COLORS[resolveFarplaneTheme(resolvedTheme)];
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
  }, [resolvedTheme]);

  return null;
}

export function ThemeProvider({ children }: PropsWithChildren) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={DEFAULT_FARPLANE_THEME}
      disableTransitionOnChange
      enableColorScheme
      enableSystem
      storageKey={FARPLANE_THEME_STORAGE_KEY}
    >
      <ThemeDocumentBridge />
      {children}
    </NextThemesProvider>
  );
}
