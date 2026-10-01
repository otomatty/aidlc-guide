type Handler = () => void;

const handlers = new Set<Handler>();

/** Run `handler` whenever the host reports video packs installed or removed. */
export function onVideoPacksChanged(handler: Handler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

/** Host `video-packs-changed`: every open video card re-asks for its page's video. */
export function deliverVideoPacksChanged(): void {
  for (const handler of handlers) handler();
}
