import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * App-root error boundary. Catches unhandled render/lifecycle errors so a crash
 * shows a friendly fallback instead of a silent white screen. No vendor, no DB —
 * logs to the console (visible in prod devtools) and offers a reload.
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ENDZ crashed:", error, info.componentStack);
  }

  private handleReload = () => {
    window.location.assign("/");
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="text-center max-w-sm">
          <h1 className="font-display text-3xl font-bold mb-3">
            Something went wrong
          </h1>
          <p className="text-muted-foreground mb-6">
            ENDZ hit an unexpected error. Reloading usually fixes it.
          </p>
          <button
            onClick={this.handleReload}
            className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Reload ENDZ
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
