import {
  BUNDLED_PLUGINS,
  type BundledPlugin,
  type BundledPluginCatalog,
  type BundledPluginRequirement,
  type BundledPluginStage,
} from "@aidlc-guide/shared-types";
import { ArrowLeftIcon, ChevronRightIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PanelBody, PanelShell } from "@/shell/PanelShell.tsx";
import { useAppState, useDispatch } from "@/store/context.tsx";
import { svgDataUrl } from "@/viewer/local-image.ts";

/**
 * 「プラグイン」: the AI-DLC plugins the extension ships, shown before anything is installed —
 * what a plugin changes in the workflow, an example of what it produces, who it suits, what it
 * needs, and the files it adds and changes (docs/maintenance/plugins-page-design.md).
 *
 * Stage 1 of that design: the page reads only the bundled catalog, so the browser shows the same
 * thing as the IDE. Installing comes later; until then the page says so and offers no button.
 */

const PHASE_LABELS: Record<string, string> = {
  ideation: "Ideation",
  inception: "Inception",
  construction: "Construction",
  operation: "Operation",
};

const ORIGIN_LABELS: Record<BundledPluginStage["origin"], string | null> = {
  plugin: "＋ 追加",
  "core-extended": "△ 手順を追記",
  core: null,
};

const LEVEL_LABELS: Record<BundledPluginRequirement["level"], string> = {
  required: "必須",
  recommended: "推奨",
  info: "参考",
};

function StatusBadge({ plugin }: { plugin: BundledPlugin }): ReactNode {
  return plugin.status === "preview" ? <Badge variant="outline">試験版</Badge> : null;
}

function PluginCard({ plugin, onOpen }: { plugin: BundledPlugin; onOpen: () => void }): ReactNode {
  return (
    <Card data-testid={`plugin-card-${plugin.name}`} size="sm">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <span>{plugin.title}</span>
          <span className="font-mono text-xs text-muted-foreground">v{plugin.version}</span>
          <StatusBadge plugin={plugin} />
        </CardTitle>
        <CardDescription>{plugin.tagline}</CardDescription>
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`${plugin.title} の詳細`}
            onClick={onOpen}
          >
            詳しく見る
            <ChevronRightIcon data-icon="inline-end" />
          </Button>
        </div>
      </CardHeader>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function StageFlow({ stages }: { stages: BundledPluginStage[] }): ReactNode {
  const phases = [...new Set(stages.map((stage) => stage.phase))];
  return (
    <div data-testid="plugin-stages" className="flex flex-col gap-3">
      {phases.map((phase) => (
        <div key={phase} className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">
            {PHASE_LABELS[phase] ?? phase}
          </p>
          <ol className="flex flex-col gap-1">
            {stages
              .filter((stage) => stage.phase === phase)
              .map((stage) => {
                const origin = ORIGIN_LABELS[stage.origin];
                return (
                  <li
                    key={stage.slug}
                    data-origin={stage.origin}
                    className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-1.5 text-sm data-[origin=plugin]:border-primary"
                  >
                    <span>{stage.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{stage.slug}</span>
                    {origin === null ? null : (
                      <Badge variant={stage.origin === "plugin" ? "default" : "secondary"}>
                        {origin}
                      </Badge>
                    )}
                    {stage.perUnit ? <Badge variant="outline">Unit ごと</Badge> : null}
                  </li>
                );
              })}
          </ol>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        ＋ はプラグインが足すステージ、△ は標準のステージにプラグインの手順を追記するステージです。
      </p>
    </div>
  );
}

function FileList({ title, files }: { title: string; files: string[] }): ReactNode {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer">
        {title}（{files.length} 件）
      </summary>
      <ul className="mt-1 flex flex-col gap-0.5 font-mono text-xs wrap-anywhere">
        {files.map((file) => (
          <li key={file}>{file}</li>
        ))}
      </ul>
    </details>
  );
}

function PluginDetail({
  plugin,
  onBack,
}: {
  plugin: BundledPlugin;
  onBack: () => void;
}): ReactNode {
  return (
    <article data-testid={`plugin-detail-${plugin.name}`} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div>
          <Button type="button" variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeftIcon data-icon="inline-start" />
            一覧に戻る
          </Button>
        </div>
        <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
          <span>{plugin.title}</span>
          <span className="font-mono text-xs text-muted-foreground">v{plugin.version}</span>
          <StatusBadge plugin={plugin} />
        </h2>
        <p className="text-sm">{plugin.tagline}</p>
        <p className="text-sm text-muted-foreground">{plugin.summary}</p>
      </div>

      <Section title="何が変わるか">
        <p className="text-sm text-muted-foreground">
          進め方 <code className="font-mono">{plugin.scope}</code>{" "}
          で実行するステージです（初期化を除く）。
        </p>
        <StageFlow stages={plugin.stages} />
        {plugin.sample === null ? null : (
          <figure className="flex flex-col gap-1">
            <img
              className="viewer__diagram"
              src={svgDataUrl(plugin.sample.svg)}
              alt={plugin.sample.alt}
            />
            <figcaption className="text-xs text-muted-foreground">{plugin.sample.alt}</figcaption>
          </figure>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">合う人</p>
            <ul className="list-disc pl-5 text-sm">
              {plugin.fitFor.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">合わない人</p>
            <ul className="list-disc pl-5 text-sm">
              {plugin.notFitFor.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section title="必要なもの">
        <ul data-testid="plugin-requirements" className="flex flex-col gap-1.5 text-sm">
          <li>
            <Badge variant="secondary">必須</Badge> Claude Code（
            <code className="font-mono">.claude</code>）で AI-DLC を使っていること
          </li>
          {plugin.requirements.map((requirement) => (
            <li key={requirement.id}>
              <Badge variant={requirement.level === "required" ? "secondary" : "outline"}>
                {LEVEL_LABELS[requirement.level]}
              </Badge>{" "}
              {requirement.label}:{" "}
              <span className="text-muted-foreground">{requirement.detail}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="追加・変更されるファイル">
        <div data-testid="plugin-files" className="flex flex-col gap-1.5">
          <FileList title="追加されるファイル" files={plugin.files.added} />
          <FileList title="変更されるファイル" files={plugin.files.changed} />
          <p className="text-xs text-muted-foreground">
            アプリケーションのコードは変えません。変わるのは AI-DLC の設定（
            <code className="font-mono">.claude/</code>
            ）だけで、AI-DLC の記録（<code className="font-mono">aidlc/</code>
            ）に、プラグインの選択を変えた記録が 1 行残ります。
          </p>
        </div>
      </Section>

      <Section title="始め方">
        <p className="text-sm text-muted-foreground">
          導入した後、Claude Code で次のように始めます。
        </p>
        <code className="block rounded-md border bg-muted px-3 py-2 font-mono text-sm wrap-anywhere">
          {plugin.startCommand}
        </code>
      </Section>
    </article>
  );
}

export function PluginsPanel({
  catalog = BUNDLED_PLUGINS,
}: {
  catalog?: BundledPluginCatalog;
}): ReactNode {
  const dispatch = useDispatch();
  const [open, setOpen] = useState<string | null>(null);
  const selected = catalog.plugins.find((plugin) => plugin.name === open) ?? null;
  return (
    <PanelShell
      headingId="plugins-heading"
      title="プラグイン"
      headingFont="body"
      testId="plugins-panel"
      returnFocusSelector='[data-testid="header-menu-trigger"]'
      onClose={() => dispatch({ type: "plugins", open: false })}
    >
      <PanelBody>
        <div className="flex flex-wrap items-center gap-x-1 text-sm">
          <p>AI-DLC に、決まった進め方を追加します。</p>
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => dispatch({ type: "customization", open: true })}
          >
            自分で作る場合はカスタマイズへ
          </Button>
        </div>
        <p
          data-testid="plugins-install-pending"
          className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground"
        >
          この画面からの導入は準備中です。いまは、プラグインの内容を確かめられます。
        </p>
        {selected !== null ? (
          <PluginDetail plugin={selected} onBack={() => setOpen(null)} />
        ) : catalog.plugins.length === 0 ? (
          <p data-testid="plugins-empty" className="text-sm text-muted-foreground">
            同梱のプラグインはありません。
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {catalog.plugins.map((plugin) => (
              <PluginCard key={plugin.name} plugin={plugin} onOpen={() => setOpen(plugin.name)} />
            ))}
          </div>
        )}
      </PanelBody>
    </PanelShell>
  );
}

export default function PluginsPage(): ReactNode {
  const state = useAppState();
  return state.route.name === "plugins" ? <PluginsPanel /> : null;
}
