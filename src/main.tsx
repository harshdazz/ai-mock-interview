import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import App from "./App.tsx";
import { ToasterProvider } from "./provider/toast-provider.tsx";
import { ThemeProvider } from "./provider/theme-provider.tsx";
import { AuthProvider } from "./providers/auth-provider.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <App />
        <ToasterProvider />
      </ThemeProvider>
    </AuthProvider>
  </StrictMode>
);
