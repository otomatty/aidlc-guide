type Listener<A extends unknown[]> = (...args: A) => void;

/** A minimal typed event emitter: `E` maps event names to their argument tuples. */
export class Emitter<E extends Record<string, unknown[]>> {
  private readonly handlers: { [K in keyof E]?: Listener<E[K]>[] } = {};

  /** Subscribe; the returned function unsubscribes. */
  on<K extends keyof E>(event: K, fn: Listener<E[K]>): () => void {
    (this.handlers[event] ??= []).push(fn);
    return () => this.off(event, fn);
  }

  off<K extends keyof E>(event: K, fn: Listener<E[K]>): void {
    this.handlers[event] = (this.handlers[event] ?? []).filter((h) => h !== fn);
  }

  protected emit<K extends keyof E>(event: K, ...args: E[K]): void {
    for (const fn of [...(this.handlers[event] ?? [])]) fn(...args);
  }
}
