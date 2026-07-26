import type { ReactNode } from "react";
import { isExternal, safeHref, useProjectLinks } from "../services/docs.ts";
import { useAppState, useDispatch } from "../store/context.tsx";
import { viewValue } from "../store/state.ts";
import { GuidesButton } from "./GuidesButton.tsx";
import { IntentPicker } from "./IntentPicker.tsx";
import { LiveStatus } from "./LiveStatus.tsx";
import { ReadOnlyBadge } from "./ReadOnlyBadge.tsx";
import { ThemeToggle } from "./ThemeToggle.tsx";

/** Shared app chrome — stays mounted on home, stage detail, and guides routes. */
export function Header(): ReactNode {
  const state = useAppState();
  const dispatch = useDispatch();
  useProjectLinks();
  const links = viewValue(state.projectLinks) ?? [];
  const onHome = state.selected !== null || state.guidesOpen || state.agentOpen !== null;

  return (
    <header className="header">
      <button
        type="button"
        className="header__title"
        data-testid="header-home"
        aria-current={onHome ? undefined : "page"}
        onClick={() => {
          dispatch({ type: "home" });
        }}
      >
        AIDLC Guide
      </button>
      <IntentPicker />
      <GuidesButton />
      {state.hostMode ? <ReadOnlyBadge /> : null}
      <div className="header__trailing">
        <nav className="flex gap-3" aria-label="プロジェクトリンク">
          {links.map((link) => {
            const href = safeHref(link.target);
            if (href === null) return null;
            return (
              <a
                key={link.label}
                href={href}
                className="text-primary underline-offset-4 hover:underline"
                rel="noopener noreferrer"
                {...(isExternal(href) ? { target: "_blank" } : {})}
              >
                {link.label}
              </a>
            );
          })}
        </nav>
        <LiveStatus live={state.live} />
        <ThemeToggle />
      </div>
    </header>
  );
}
