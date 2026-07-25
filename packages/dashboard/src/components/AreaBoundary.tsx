import { Component, type ErrorInfo, type ReactNode } from "react";
import { UnparseableBadge } from "./atoms.tsx";

/**
 * R-UI-1: one of these wraps each of the four areas, so a render bug in the
 * matrix cannot take the Now strip down with it. React only offers this as a
 * class component — there is no hook equivalent.
 */

interface Props {
  name: string;
  children: ReactNode;
}

interface State {
  message: string | null;
  /** Remounts the subtree on retry: a new key throws the broken tree away. */
  attempt: number;
}

export class AreaBoundary extends Component<Props, State> {
  state: State = { message: null, attempt: 0 };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    // Local tool, local console: enough to debug, and it keeps the failure
    // visible to the developer while the user still sees the other areas.
    console.error(`[${this.props.name}]`, error, info.componentStack);
  }

  private readonly retry = (): void => {
    this.setState((previous) => ({ message: null, attempt: previous.attempt + 1 }));
  };

  render(): ReactNode {
    const { message, attempt } = this.state;
    if (message === null) return <div key={attempt}>{this.props.children}</div>;
    return (
      <div className="area-error" data-testid={`area-error-${this.props.name}`}>
        <UnparseableBadge detail={`${this.props.name}: ${message}`} />
        <button type="button" className="button" onClick={this.retry}>
          この領域を再読み込み
        </button>
      </div>
    );
  }
}
