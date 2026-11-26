import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

interface State {
  error: Error | null;
}

/**
 * Catches render errors in a page so one broken widget never blanks the app.
 * A stale lazy chunk after a deploy (PWA) is the most common cause, so the
 * recovery action is a hard reload.
 */
export default class AppErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AppErrorBoundary]", error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const isEn = (document.documentElement.lang || navigator.language || "ko").startsWith("en");
    return (
      <div className="relative z-10 flex min-h-[70vh] flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="text-5xl">🥅</div>
        <h2 className="font-display text-3xl tracking-wider text-primary">{isEn ? "OFFSIDE!" : "오프사이드!"}</h2>
        <p className="text-sm text-muted-foreground">
          {isEn ? "Something went wrong while loading this page." : "페이지를 불러오는 중 문제가 발생했어요."}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="gradient-pink pressable flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-primary-foreground"
        >
          <RefreshCw size={14} /> {isEn ? "Reload" : "다시 불러오기"}
        </button>
      </div>
    );
  }
}
