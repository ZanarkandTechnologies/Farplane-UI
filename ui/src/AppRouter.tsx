import { Navigate, Route, Routes } from "react-router-dom";
import type React from "react";

import { LandingPage } from "@/pages/LandingPage";
import { OfficePage } from "@/pages/OfficePage";

export function AppRouter(): React.JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/office" element={<OfficePage />} />
      <Route path="/office/public" element={<OfficePage accessMode="public" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
