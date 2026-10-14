import path from "node:path";
import { watch } from "chokidar";

/** Workspace navigation must remain live even before a record exists. */
export function watchSelection(
  root: string,
  onChange: () => void,
  onError: () => void,
): () => void {
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const relevant = (file: string): boolean => {
    const relative = path.relative(root, file).split(path.sep).join("/");
    return (
      relative === "" ||
      relative === "aidlc" ||
      relative === "aidlc/active-space" ||
      relative === "aidlc/spaces" ||
      /^aidlc\/spaces\/[^/]+(?:\/intents(?:\/(?:active-intent|intents\.json|[^/]+(?:\/aidlc-state\.md)?))?)?$/.test(
        relative,
      )
    );
  };
  const watcher = watch(root, {
    ignoreInitial: true,
    followSymlinks: false,
    ignored: (file) => !relevant(file),
  });
  watcher.on("all", () => {
    if (disposed) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!disposed) onChange();
    }, 100);
  });
  watcher.on("error", () => {
    if (!disposed) onError();
  });
  return () => {
    disposed = true;
    clearTimeout(timer);
    void watcher.close();
  };
}
