import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";

import { AppRouter } from "@/AppRouter";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ShellCorpConvexProvider } from "@/providers/convex-provider";
import { GatewayProvider } from "@/providers/gateway-provider";
import { OpenClawAdapterProvider } from "@/providers/openclaw-adapter-provider";
import "./styles.css";

document.documentElement.classList.add("dark");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <ShellCorpConvexProvider>
        <GatewayProvider>
          <OpenClawAdapterProvider>
            <BrowserRouter>
              <AppRouter />
            </BrowserRouter>
          </OpenClawAdapterProvider>
        </GatewayProvider>
      </ShellCorpConvexProvider>
      <Toaster />
    </ThemeProvider>
  </React.StrictMode>,
);
