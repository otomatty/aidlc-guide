import type { ReactNode } from "react";
import { isExternal, safeHref, useProjectLinks } from "../services/docs.ts";
import { useAppState } from "../store/context.tsx";
import { viewValue } from "../store/state.ts";
import { GuidesButton } from "./GuidesButton.tsx";
import { IntentPicker } from "./IntentPicker.tsx";
import { LiveStatus } from "./LiveStatus.tsx";
import { ReadOnlyBadge } from "./ReadOnlyBadge.tsx";
import { ThemeToggle } from "./ThemeToggle.tsx";

export function Header(): ReactNode {
  const state = useAppState();
  useProjectLinks();
  const links = viewValue(state.projectLinks) ?? [];

  return (
    <header className="header">
      <span className="header__title">AIDLC Guide</span>
      <IntentPicker />
      <GuidesButton />
      {state.hostMode ? <ReadOnlyBadge /> : null}
      <nav className="header__links" aria-label="プロジェクトリンク">
        {links.map((link) => {
          const href = safeHref(link.target);
          if (href === null) return null;
          return (
            <a
              key={link.label}
              href={href}
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
    </header>
  );
}
