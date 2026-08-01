import type { OfficialDocsLocale } from "@aidlc-guide/shared-types";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

const LOCALES: readonly OfficialDocsLocale[] = ["en", "ja"];

export interface LocaleControlProps {
  locale: OfficialDocsLocale;
  onChange: (locale: OfficialDocsLocale) => void;
}

/** en | ja toggle; `aria-current` marks the active locale. */
export function LocaleControl({ locale, onChange }: LocaleControlProps): ReactNode {
  return (
    <fieldset className="m-0 flex items-center gap-1 border-0 p-0" data-testid="locale-control">
      <legend className="sr-only">Locale</legend>
      {LOCALES.map((code) => {
        const current = code === locale;
        return (
          <Button
            key={code}
            type="button"
            size="xs"
            variant={current ? "secondary" : "outline"}
            data-testid={`locale-${code}`}
            aria-current={current ? "true" : undefined}
            onClick={() => {
              onChange(code);
            }}
          >
            {code}
          </Button>
        );
      })}
    </fieldset>
  );
}
