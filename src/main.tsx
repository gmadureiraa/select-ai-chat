import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { captureError, initObservability } from "@/lib/observability";

initObservability();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary onError={(error) => captureError(error)}>
    <App />
  </ErrorBoundary>
);
