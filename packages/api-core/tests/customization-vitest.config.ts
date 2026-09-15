import { defineConfig } from "vitest/config";

/** These isolated tests never elect or edit this checkout's active AI-DLC intent. */
export default defineConfig({
  test: { environment: "node", include: ["packages/api-core/tests/customization.test.ts"] },
});
