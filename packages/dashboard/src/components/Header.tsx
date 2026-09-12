import type { RemainingEstimate } from "@aidlc-guide/shared-types";
import { formatDuration } from "@aidlc-guide/shared-types";
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

export interface HeaderProps {
  /**
   * The whole-workflow roll-up, already gated on freshness by
   * `store/select-timing.ts` — `null` until `/api/timings` lands, or while
   * the payload still describes the stage that was current a moment ago (its
   * total would still bill that stage's remainder). The header renders the
   * total only when this is a live number; it makes no staleness judgement of
   * its own (issue #10).
   */
  remaining?: RemainingEstimate | null;
}

/** Shared app chrome — stays mounted on home, stage detail, and guides routes. */
export function Header({ remaining }: HeaderProps = {}): ReactNode {
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
    <header className="z-50 flex min-w-0 items-start gap-3 border-b bg-background px-4 py-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 max-w-full flex-initial">
          <IntentPicker />
        </div>
        <div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center gap-x-3 gap-y-1 [overflow-wrap:anywhere]">
          {state.hostMode ? <ReadOnlyBadge /> : null}
          <LiveStatus live={state.live} />
          {remaining?.totalRemainingMs == null ? null : (
            <span
              className="text-muted-foreground text-sm tabular-nums"
              data-testid="header-total-remaining"
            >
              残り実作業 ≈{formatDuration(remaining.totalRemainingMs)}
              {remaining.lowConfidence ? "（参考値）" : ""}
            </span>
          )}
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
                現在地
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
