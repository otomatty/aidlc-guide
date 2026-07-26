import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App.tsx";
import { fetchWorkflow } from "./services/api.ts";
import { createBrowserTransport, initTransport, setTransport } from "./services/transport/index.ts";

/**
 * P-UI-2: bootstrap starts before React mounts. Transport must be ready first.
 */
async function bootstrapApp(): Promise<void> {
  if (
    typeof window !== "undefined" &&
    "acquireVsCodeApi" in window &&
    typeof window.acquireVsCodeApi === "function"
  ) {
    await initTransport();
  } else {
    setTransport(createBrowserTransport());
  }

  const bootstrap = fetchWorkflow();
  const container = document.getElementById("root");
  if (container === null) throw new Error("#root is missing from index.html");

  createRoot(container).render(
    <StrictMode>
      <App bootstrap={bootstrap} />
    </StrictMode>,
  );
}

void bootstrapApp();
