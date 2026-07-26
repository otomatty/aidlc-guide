import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { UnparseableBadge } from "./atoms.tsx";

interface Props {
  name: string;
  children: ReactNode;
}

interface State {
  message: string | null;
  attempt: number;
}

export class AreaBoundary extends Component<Props, State> {
  state: State = { message: null, attempt: 0 };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(`[${this.props.name}]`, error, info.componentStack);
  }

  private readonly retry = (): void => {
    this.setState((previous) => ({ message: null, attempt: previous.attempt + 1 }));
  };

  render(): ReactNode {
    const { message, attempt } = this.state;
    // `contents` keeps this wrapper out of flex/grid so layout CSS applies to children.
    if (message === null) return <div key={attempt} className="contents">{this.props.children}</div>;
    return (
      <div data-testid={`area-error-${this.props.name}`}>
        <UnparseableBadge detail={`${this.props.name}: ${message}`} />
        <Button type="button" variant="outline" onClick={this.retry}>
          この領域を再読み込み
        </Button>
      </div>
    );
  }
}
