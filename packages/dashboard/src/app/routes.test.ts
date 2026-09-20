import { describe, expect, it } from "vitest";
import {
  HOME_ROUTE,
  isHomeRoute,
  routeAgent,
  routeDeepLink,
  routeSelection,
  selectionRoute,
  showsNowStrip,
} from "@/app/routes.ts";

describe("in-webview AppRoute", () => {
  it("maps stage and cell routes to the previous Selection shape", () => {
    expect(routeSelection({ name: "stage", slug: "code-generation" })).toEqual({
      kind: "stage",
      slug: "code-generation",
    });
    expect(routeSelection({ name: "cell", unit: "reader-core", stage: "nfr-design" })).toEqual({
      kind: "cell",
      unit: "reader-core",
      stage: "nfr-design",
    });
    expect(routeSelection(HOME_ROUTE)).toBeNull();
    expect(selectionRoute({ kind: "stage", slug: "code-generation" })).toEqual({
      name: "stage",
      slug: "code-generation",
    });
  });

  it("keeps NowStrip on record pages and parks every other route", () => {
    expect(isHomeRoute(HOME_ROUTE)).toBe(true);
    expect(showsNowStrip({ name: "stage", slug: "x" })).toBe(true);
    expect(showsNowStrip({ name: "agent", id: "a", returnTo: null })).toBe(true);
    expect(showsNowStrip({ name: "settings" })).toBe(false);
    expect(routeAgent({ name: "agent", id: "a", returnTo: null })).toEqual({
      id: "a",
      returnTo: null,
    });
    expect(routeDeepLink({ name: "docs", deepLink: { locale: "ja" } })).toEqual({ locale: "ja" });
    expect(routeDeepLink({ name: "docs" })).toBeNull();
  });
});
