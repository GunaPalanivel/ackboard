import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Ackboard] render error', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-8 font-sans">
          <div className="max-w-md">
            <h1 className="text-lg font-semibold text-slate-50 mb-2">The dashboard hit a render error</h1>
            <p className="text-sm text-slate-400 mb-4">
              Reload the page to start again. Agent tool calls that fail inside execute return a structured error
              to the agent instead of taking the tab down.
            </p>
            <pre className="text-xs text-red-400 bg-slate-900 p-3 rounded overflow-auto border border-slate-800">
              {this.state.error.message}
            </pre>
            <button
              className="mt-4 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-sm"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
