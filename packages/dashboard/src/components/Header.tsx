import {
  BookOpenIcon,
  ChartNoAxesCombinedIcon,
  HomeIcon,
  LinkIcon,
  MenuIcon,
  SettingsIcon,
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
    !state.settingsOpen;

  return (
    <header className="z-50 flex min-w-0 shrink-0 items-start gap-3 border-b bg-background px-4 py-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
        <Button
          type="button"
          variant="outline"
          id="header-home-button"
          data-testid="header-home-button"
          aria-current={onHome ? "page" : undefined}
          onClick={() => dispatch({ type: "home" })}
        >
          <HomeIcon data-icon="inline-start" />
          ステージ一覧
        </Button>
        <div className="min-w-0 max-w-full flex-initial">
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
            <MenuIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-64 max-w-[calc(100vw-2rem)]"
            aria-label="メニュー"
          >
            <DropdownMenuGroup>
              <DropdownMenuItem
                data-testid="header-home"
                aria-current={onHome ? "page" : undefined}
                onClick={() => dispatch({ type: "home" })}
              >
                <HomeIcon />
                ステージ一覧
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid="effectiveness-open"
                aria-current={state.effectivenessOpen ? "page" : undefined}
                onClick={() => dispatch({ type: "effectiveness", open: true })}
              >
                <ChartNoAxesCombinedIcon />
                効果測定
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid="official-docs-open"
                aria-current={state.docsShellOpen ? "page" : undefined}
                onClick={() => dispatch({ type: "docs-shell", open: true })}
              >
                <BookOpenIcon />
                ドキュメント
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid="settings-open"
                aria-current={state.settingsOpen ? "page" : undefined}
                onClick={() => dispatch({ type: "settings", open: true })}
              >
                <SettingsIcon />
                設定
              </DropdownMenuItem>
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
