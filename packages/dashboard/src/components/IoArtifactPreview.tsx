import { PencilIcon, XIcon } from "lucide-react";
import { lazy, type ReactNode, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { useDelayedLoading } from "../hooks/useDelayedLoading.ts";
import { useFetchView } from "../hooks/useFetchView.ts";
import { fetchArtifact } from "../services/api.ts";
import { canOpenDocsInIde, editFileInIde } from "../services/docs.ts";
import { AreaError, Skeleton } from "./atoms.tsx";

const MarkdownSurface = lazy(async () => {
  const mod = await import("../viewer/MarkdownSurface.tsx");
  return { default: mod.MarkdownSurface };
});

function basename(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? path : path.slice(slash + 1);
}

export interface IoArtifactPreviewProps {
  path: string;
  onClose: () => void;
}

/**
 * In-dashboard preview for a StageCard I/O Markdown path (issue #32).
 * Browse stays in the webview; an explicit edit action opens VS Code as a tab.
 */
export function IoArtifactPreview({ path, onClose }: IoArtifactPreviewProps): ReactNode {
  const view = useFetchView(() => fetchArtifact(path), [path]);
  const showSkeleton = useDelayedLoading(view?.kind === "loading" || view === null);
  const markdown = view?.kind === "success" || view?.kind === "partial" ? view.value : null;
  const canEdit = canOpenDocsInIde();

  return (
    <section
      className="mt-5 border-t pt-4"
      aria-label="成果物プレビュー"
      data-testid="io-artifact-preview"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2" data-testid="io-preview-toolbar">
        <span className="font-mono text-xs text-muted-foreground" data-testid="io-preview-path">
          {basename(path)}
        </span>
        {canEdit ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="io-preview-edit"
            onClick={() => {
              editFileInIde(path);
            }}
          >
            <PencilIcon data-icon="inline-start" />
            エディタで編集
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="io-preview-close"
          onClick={onClose}
        >
          <XIcon data-icon="inline-start" />
          プレビューを閉じる
        </Button>
      </div>

      {view?.kind === "error" ? (
        <AreaError detail={view.detail} />
      ) : view?.kind === "empty" ? (
        <p className="text-sm text-muted-foreground" data-testid="io-preview-empty">
          {view.hint}
        </p>
      ) : markdown === null ? (
        showSkeleton ? (
          <Skeleton lines={6} label="成果物" />
        ) : null
      ) : (
        <>
          {view?.kind === "partial" ? (
            <ul className="viewer__notes" data-testid="io-preview-notes">
              {view.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
          <Suspense fallback={<Skeleton lines={6} label="成果物" />}>
            <MarkdownSurface markdown={markdown} editable={null} />
          </Suspense>
        </>
      )}
    </section>
  );
}
