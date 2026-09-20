import { LoadingSuspense } from "@/shared/loading/LoadingSequence.tsx";
import { AgentPanel } from "@/features/agent/AgentPage.tsx";
import { AreaBoundary } from "@/shell/AreaBoundary.tsx";
import { DetailPanel } from "@/features/stage/StagePage.tsx";
import { DocsShell } from "@/features/docs/DocsPage.tsx";
import { GuidesPanel } from "@/features/guides/GuidesPage.tsx";
import { CustomizationSkeleton } from "@/features/customization/components/CustomizationSkeleton.tsx";
import { EffectivenessSkeleton } from "@/features/effectiveness/components/EffectivenessSkeleton.tsx";
import { SettingsPage } from "@/features/settings/SettingsPage.tsx";
import { useAppState, useDispatch } from "@/store/context.tsx";
import { lazy, type ReactNode } from "react";

const EffectivenessPanel = lazy(
  async () => await import("@/features/effectiveness/EffectivenessPage.tsx"),
);
const CustomizationPage = lazy(
  async () => await import("@/features/customization/CustomizationPage.tsx"),
);

/**
 * Child routes under the shared header. Home stays parked in App, not here.
 * Customization is keep-alive: first visit mounts it, later visits only unhide.
 */
export function RouteOutlet({
  visitedCustomization,
}: {
  visitedCustomization: boolean;
}): ReactNode {
  const { route, hostMode, customizationRefresh } = useAppState();
  const dispatch = useDispatch();
  const customizationOpen = route.name === "customization";

  return (
    <>
      <AreaBoundary name="detail-panel">
        <DetailPanel />
      </AreaBoundary>
      <AreaBoundary name="guides-panel">
        <GuidesPanel />
      </AreaBoundary>
      <AreaBoundary name="docs-shell">
        <DocsShell />
      </AreaBoundary>
      <AreaBoundary name="agent-panel">
        <AgentPanel />
      </AreaBoundary>
      {route.name === "settings" ? (
        <AreaBoundary name="settings-page">
          <SettingsPage />
        </AreaBoundary>
      ) : null}
      {customizationOpen || visitedCustomization ? (
        <div hidden={!customizationOpen} inert={!customizationOpen}>
          <AreaBoundary name="customization-page">
            <LoadingSuspense fallback={<CustomizationSkeleton />}>
              <CustomizationPage
                open={customizationOpen}
                hostMode={hostMode}
                refreshVersion={customizationRefresh}
                onSettings={() => dispatch({ type: "settings", open: true })}
              />
            </LoadingSuspense>
          </AreaBoundary>
        </div>
      ) : null}
      {route.name === "effectiveness" ? (
        <AreaBoundary name="effectiveness-panel">
          <LoadingSuspense fallback={<EffectivenessSkeleton page />}>
            <EffectivenessPanel />
          </LoadingSuspense>
        </AreaBoundary>
      ) : null}
    </>
  );
}
