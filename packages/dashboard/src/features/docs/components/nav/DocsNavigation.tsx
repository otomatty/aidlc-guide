import type { MarkdownItem, OfficialDocsToc } from "@aidlc-guide/shared-types";
import { type ReactNode, useMemo } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { type ViewState, viewValue } from "@/store/state.ts";
import { AreaError } from "@/shared/atoms.tsx";
import { NavigationSkeleton } from "@/shared/loading/NavigationSkeleton.tsx";
import { NavList, NavListButton } from "@/shared/NavList.tsx";
import { DocsToc } from "./DocsToc.tsx";
import { type DocsCategory, isReleaseDoc, officialToc, releaseEntries } from "@/features/docs/utils/docs-navigation.ts";

interface DocsNavigationProps {
  category: DocsCategory;
  onCategoryChange: (category: DocsCategory) => void;
  tocView: ViewState<OfficialDocsToc> | null;
  guidesView: ViewState<MarkdownItem[]> | null;
  selectedPath: string | null;
  selectedGuide: string | null;
  onSelectPath: (path: string) => void;
  onSelectGuide: (name: string) => void;
}

export function DocsNavigation({
  category,
  onCategoryChange,
  tocView,
  guidesView,
  selectedPath,
  selectedGuide,
  onSelectPath,
  onSelectGuide,
}: DocsNavigationProps): ReactNode {
  const toc = tocView === null ? null : viewValue(tocView);
  const guides = guidesView === null ? null : viewValue(guidesView);
  const official = useMemo(() => (toc === null ? null : officialToc(toc)), [toc]);
  const releases = useMemo(() => (toc === null ? [] : releaseEntries(toc)), [toc]);

  return (
    <Tabs
      value={category}
      onValueChange={(value) => {
        if (value === "workflow" || value === "extension") {
          onCategoryChange(value);
        }
      }}
      className="min-h-0 flex-1 gap-4"
    >
      <div className="px-4">
        <TabsList aria-label="ドキュメントの種類" className="grid w-full grid-cols-2">
          <TabsTrigger value="workflow" className="h-auto min-h-10 min-w-0 whitespace-normal">
            ワークフロー
          </TabsTrigger>
          <TabsTrigger value="extension" className="h-auto min-h-10 min-w-0 whitespace-normal">
            拡張機能
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsPanel value="workflow" className="min-h-0 overflow-y-auto pb-4">
        <p className="mb-3 px-4 text-sm text-muted-foreground">
          aidlc-workflows の公式ドキュメントと更新履歴を調べる。
        </p>
        {tocView?.kind === "error" ? (
          <div className="px-4">
            <AreaError detail={tocView.detail} />
          </div>
        ) : official === null ? (
          <div className="px-4">
            <NavigationSkeleton label="公式ドキュメント一覧" />
          </div>
        ) : (
          <Accordion
            key={isReleaseDoc(selectedPath ?? "") ? "releases" : "official"}
            defaultValue={[isReleaseDoc(selectedPath ?? "") ? "releases" : "official"]}
            className="px-4"
          >
            <AccordionItem value="official">
              <AccordionTrigger>公式ドキュメント</AccordionTrigger>
              <AccordionContent>
                <DocsToc tree={official} selectedPath={selectedPath} onSelect={onSelectPath} />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="releases">
              <AccordionTrigger>更新履歴</AccordionTrigger>
              <AccordionContent>
                <nav aria-label="更新履歴一覧">
                  {releases.length === 0 ? (
                    <p className="text-sm text-muted-foreground">更新履歴がありません。</p>
                  ) : (
                    <NavList>
                      {releases.map((entry) => (
                        <li key={entry.id}>
                          <NavListButton
                            data-active={selectedPath === entry.path}
                            aria-current={selectedPath === entry.path ? "page" : undefined}
                            data-testid={`docs-toc-${entry.path}`}
                            onClick={() => onSelectPath(entry.path)}
                          >
                            {entry.path === "overview/release-highlights.md"
                              ? "更新のハイライト"
                              : entry.path === "overview/changelog.md"
                                ? "更新履歴一覧"
                                : entry.title}
                          </NavListButton>
                        </li>
                      ))}
                    </NavList>
                  )}
                </nav>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </TabsPanel>
      <TabsPanel value="extension" className="min-h-0 overflow-y-auto px-4 pb-4">
        <p className="mb-3 text-sm text-muted-foreground">
          AIDLC Guide 拡張機能の導入と操作方法を調べる。
        </p>
        <nav aria-label="使い方ガイド一覧">
          {guidesView?.kind === "error" ? (
            <AreaError detail={guidesView.detail} />
          ) : guides === null ? (
            <NavigationSkeleton label="使い方ガイド一覧" />
          ) : guides.length === 0 ? (
            <p className="text-sm text-muted-foreground">ガイドがありません。</p>
          ) : (
            <NavList>
              {guides.map((guide) => (
                <li key={guide.name}>
                  <NavListButton
                    data-active={selectedGuide === guide.name}
                    aria-current={selectedGuide === guide.name ? "page" : undefined}
                    data-testid={`docs-guide-${guide.name}`}
                    onClick={() => onSelectGuide(guide.name)}
                  >
                    {guide.title}
                  </NavListButton>
                </li>
              ))}
            </NavList>
          )}
        </nav>
      </TabsPanel>
    </Tabs>
  );
}
