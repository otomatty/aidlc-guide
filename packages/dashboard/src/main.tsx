import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App.tsx";
import { fetchWorkflow } from "./services/api.ts";

/**
 * P-UI-2: the request goes out *before* React is mounted, so the network
 * round-trip and the first render overlap instead of queueing. By the time
 * the effect in App runs, the promise is usually already resolved.
 */
const bootstrap = fetchWorkflow();

const container = document.getElementById("root");
if (container === null) throw new Error("#root is missing from index.html");

createRoot(container).render(
  <StrictMode>
    <App bootstrap={bootstrap} />
  </StrictMode>,
);
