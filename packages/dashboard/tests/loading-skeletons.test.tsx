import { act, render, screen } from "@testing-library/react";
import { lazy, Suspense } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CustomizationSkeleton,
  DocumentSkeleton,
  EffectivenessSkeleton,
  MatrixSkeleton,
  NavigationSkeleton,
  NowStripSkeleton,
  StageDetailSkeleton,
  StageRailSkeleton,
} from "../src/components/LoadingSkeletons.tsx";
import { SKELETON_DELAY_MS } from "../src/hooks/useDelayedLoading.ts";

afterEach(() => vi.useRealTimers());

describe("layout loading placeholders", () => {
  it.each([
    ["効果測定", <EffectivenessSkeleton key="EffectivenessSkeleton" page />],
    ["カスタマイズ", <CustomizationSkeleton key="CustomizationSkeleton" />],
    ["成果物マトリクス", <MatrixSkeleton key="MatrixSkeleton" heading />],
    ["ステージ一覧", <StageRailSkeleton key="StageRailSkeleton" />],
    ["ステージ解説", <StageDetailSkeleton key="StageDetailSkeleton" />],
    ["現在のステージ", <NowStripSkeleton key="NowStripSkeleton" expanded />],
    ["本文", <DocumentSkeleton key="DocumentSkeleton" label="本文" />],
    ["一覧", <NavigationSkeleton key="NavigationSkeleton" label="一覧" />],
  ])("delays %s and exposes one named status without fake controls", (label, element) => {
    vi.useFakeTimers();
    render(element);
    const name = `${label}を読み込み中`;
    expect(screen.queryByRole("status", { name })).toBeNull();
    act(() => vi.advanceTimersByTime(SKELETON_DELAY_MS - 1));
    expect(screen.queryByRole("status", { name })).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    const status = screen.getByRole("status", { name });
    expect(status.getAttribute("aria-busy")).toBe("true");
    expect(status.children[0]?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(status.querySelectorAll("button, a, input, [tabindex]")).toHaveLength(0);
  });

  it("uses identical summary and record layouts for the lazy page and data wait", () => {
    const { container, rerender } = render(<EffectivenessSkeleton page />);
    const summary = screen.getByTestId("effectiveness-summary-skeleton");
    const records = screen.getByTestId("effectiveness-records-skeleton");
    expect(summary.children).toHaveLength(4);
    expect(summary.className).toContain("sm:grid-cols-2 xl:grid-cols-4");
    expect(records.children).toHaveLength(2);
    expect(records.className).toContain("grid-cols-cards");
    const summaryHtml = summary.outerHTML;
    const recordsHtml = records.outerHTML;
    expect(container.querySelectorAll('[data-slot="card-footer"]')).toHaveLength(6);
    rerender(<EffectivenessSkeleton />);
    expect(screen.getByTestId("effectiveness-summary-skeleton").outerHTML).toBe(summaryHtml);
    expect(screen.getByTestId("effectiveness-records-skeleton").outerHTML).toBe(recordsHtml);
  });

  it("removes the Suspense placeholder when the page resolves before the delay", async () => {
    vi.useFakeTimers();
    let resolve!: (module: { default: () => React.ReactNode }) => void;
    const Page = lazy(
      () =>
        new Promise<{ default: () => React.ReactNode }>((done) => {
          resolve = done;
        }),
    );
    const { container } = render(
      <Suspense fallback={<EffectivenessSkeleton page />}>
        <Page />
      </Suspense>,
    );
    expect(screen.queryByRole("status")).toBeNull();
    await act(async () => {
      resolve({ default: () => <h1>効果測定</h1> });
    });
    act(() => vi.advanceTimersByTime(SKELETON_DELAY_MS));
    expect(screen.getByRole("heading", { name: "効果測定" })).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
  });
});
