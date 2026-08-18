import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";

import { AppRouter } from "@/AppRouter";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { RuntimeAdapterProvider } from "@/modules/runtime";
import { FarplaneConvexProvider } from "@/providers/convex-provider";
import { GatewayProvider } from "@/providers/gateway-provider";
import { FarplaneQueryProvider } from "@/providers/query-provider";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <FarplaneQueryProvider>
        <FarplaneConvexProvider>
          <GatewayProvider>
            <RuntimeAdapterProvider>
              <BrowserRouter>
                <AppRouter />
              </BrowserRouter>
            </RuntimeAdapterProvider>
          </GatewayProvider>
        </FarplaneConvexProvider>
      </FarplaneQueryProvider>
      <Toaster />
    </ThemeProvider>
  </React.StrictMode>,
);
