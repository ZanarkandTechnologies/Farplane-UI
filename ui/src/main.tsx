import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";

import { AppRouter } from "@/AppRouter";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { FarplaneConvexProvider } from "@/providers/convex-provider";
import { GatewayProvider } from "@/providers/gateway-provider";
import { RuntimeAdapterProvider } from "@/modules/runtime";
import "./styles.css";

document.documentElement.classList.add("dark");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <FarplaneConvexProvider>
        <GatewayProvider>
          <RuntimeAdapterProvider>
            <BrowserRouter>
              <AppRouter />
            </BrowserRouter>
          </RuntimeAdapterProvider>
        </GatewayProvider>
      </FarplaneConvexProvider>
      <Toaster />
    </ThemeProvider>
  </React.StrictMode>,
);
