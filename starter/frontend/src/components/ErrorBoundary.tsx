import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  fallbackTitle?: string;
};

type State = {
  hasError: boolean;
  message: string;
};

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="m-6 rounded-xl border border-red-200 bg-red-50 p-6 text-center"
        >
          <span className="material-symbols-outlined text-4xl text-red-500 mb-2 block">error</span>
          <h2 className="text-lg font-semibold text-red-800 mb-1">
            {this.props.fallbackTitle ?? 'Algo salió mal'}
          </h2>
          <p className="text-sm text-red-700 mb-4">{this.state.message}</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
