import {
  BookOpenIcon,
  ChartNoAxesCombinedIcon,
  GripIcon,
  HomeIcon,
  LinkIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isExternal, safeHref, useProjectLinks } from "../services/docs.ts";
import { useAppState, useDispatch } from "../store/context.tsx";
import { viewValue } from "../store/state.ts";
import { IntentPicker } from "./IntentPicker.tsx";
import { LiveStatus } from "./LiveStatus.tsx";
import { ReadOnlyBadge } from "./ReadOnlyBadge.tsx";
import { ThemeToggle } from "./ThemeToggle.tsx";

/** Shared app chrome — stays mounted on home, stage detail, and guides routes. */
export function Header(): ReactNode {
  const state = useAppState();
  const dispatch = useDispatch();
  useProjectLinks();
  const links = (viewValue(state.projectLinks) ?? []).flatMap((link) => {
    const href = safeHref(link.target);
    return href === null ? [] : [{ ...link, href }];
  });
  const onHome =
    state.selected === null &&
    !state.guidesOpen &&
    !state.docsShellOpen &&
    state.agentOpen === null &&
    !state.effectivenessOpen &&
    !state.customizationOpen &&
    !state.settingsOpen;

  const destinations = [
    {
      id: "home",
      testId: "header-home",
      label: "ステージ一覧",
      icon: HomeIcon,
      active: onHome,
      onClick: () => dispatch({ type: "home" }),
    },
    {
      id: "effectiveness",
      testId: "effectiveness-open",
      label: "効果測定",
      icon: ChartNoAxesCombinedIcon,
      active: state.effectivenessOpen,
      onClick: () => dispatch({ type: "effectiveness", open: true }),
    },
    {
      id: "docs",
      testId: "official-docs-open",
      label: "ドキュメント",
      icon: BookOpenIcon,
      active: state.docsShellOpen,
      onClick: () => dispatch({ type: "docs-shell", open: true }),
    },
    {
      id: "customization",
      testId: "customization-open",
      label: "カスタマイズ",
      icon: SlidersHorizontalIcon,
      active: state.customizationOpen,
      onClick: () => dispatch({ type: "customization", open: true }),
    },
    {
      id: "settings",
      testId: "settings-open",
      label: "設定",
      icon: SettingsIcon,
      active: state.settingsOpen,
      onClick: () => dispatch({ type: "settings", open: true }),
    },
  ];

  return (
    <header className="z-50 flex min-w-0 shrink-0 items-start gap-3 border-b bg-background px-4 py-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 max-w-full flex-1">
          <IntentPicker />
        </div>
        <div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center gap-x-3 gap-y-1 [overflow-wrap:anywhere]">
          {state.hostMode ? <ReadOnlyBadge /> : null}
          <LiveStatus live={state.live} />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle />
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon"
                id="header-menu-trigger"
                data-testid="header-menu-trigger"
                aria-label="メニュー"
              />
            }
          >
            <GripIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-72 min-w-72 max-w-[calc(100vw-2rem)] p-2"
            aria-label="メニュー"
          >
            <DropdownMenuGroup data-testid="header-nav-grid" className="grid grid-cols-3 gap-1">
              {destinations.map(({ id, testId, label, icon: Icon, active, onClick }) => (
                <DropdownMenuItem
                  key={id}
                  data-testid={testId}
                  data-header-nav={id}
                  aria-current={active ? "page" : undefined}
                  onClick={onClick}
                  className="h-auto min-h-20 w-full flex-col items-center justify-center gap-1 px-1 py-2 text-center text-xs font-medium whitespace-normal aria-[current=page]:bg-secondary aria-[current=page]:text-secondary-foreground"
                >
                  <Icon className="size-7" />
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            {links.length > 0 ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>プロジェクトリンク</DropdownMenuLabel>
                  {links.map((link) => (
                    <DropdownMenuItem
                      key={`${link.label}:${link.href}`}
                      render={
                        <a
                          href={link.href}
                          rel="noopener noreferrer"
                          {...(isExternal(link.href) ? { target: "_blank" } : {})}
                        />
                      }
                    >
                      <LinkIcon />
                      <span className="min-w-0 [overflow-wrap:anywhere]">{link.label}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
