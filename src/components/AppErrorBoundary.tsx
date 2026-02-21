import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  public state: AppErrorBoundaryState = {
    hasError: false,
  };

  public static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Unhandled application error", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
          <section className="max-w-md w-full border border-border rounded-lg bg-card p-6 text-center space-y-4 shadow-sm">
            <AlertTriangle className="w-10 h-10 mx-auto text-destructive" aria-hidden="true" />
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              Vivica hit an unexpected error. Reload to restart safely.
            </p>
            <Button type="button" onClick={this.handleReload} className="w-full">
              Reload app
            </Button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
