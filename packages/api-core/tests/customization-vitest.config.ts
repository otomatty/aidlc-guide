import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** These isolated tests never elect or edit this checkout's active AI-DLC intent. */
export default defineConfig({
  root: fileURLToPath(new URL("../../../", import.meta.url)),
  test: { environment: "node", include: ["packages/api-core/tests/customization.test.ts"] },
});
