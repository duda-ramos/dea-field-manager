import React from 'react';
import { PageLoadingState } from '@/components/ui/loading-spinner';
import { ErrorBoundary, errorMonitoring } from '@/services/errorMonitoring';

interface LoadingBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error }>;
  loadingMessage?: string;
  isLoading?: boolean;
}

interface LoadingBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class LoadingBoundary extends React.Component<
  LoadingBoundaryProps,
  LoadingBoundaryState
> {
  constructor(props: LoadingBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): LoadingBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    errorMonitoring.captureError(
      new ErrorBoundary(
        errorInfo.componentStack,
        'LoadingBoundary',
        error
      ),
      {
        component: 'LoadingBoundary',
        action: 'component_did_catch',
        metadata: {
          componentStack: errorInfo.componentStack
        }
      },
      'high'
    );
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error} />;
    }

    if (this.props.isLoading) {
      return <PageLoadingState message={this.props.loadingMessage} />;
    }

    return this.props.children;
  }
}

function DefaultErrorFallback({ error }: { error?: Error }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-md">
        <div className="text-destructive text-lg font-semibold">
          Algo deu errado
        </div>
        <div className="text-muted-foreground">
          {error?.message || 'Ocorreu um erro inesperado.'}
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Recarregar página
        </button>
      </div>
    </div>
  );
}

// Hook para uso com componentes funcionais
export function useLoadingBoundary() {
  return {
    captureError: (error: Error, context?: any) => {
      errorMonitoring.captureComponentError(
        error,
        'FunctionalComponent',
        context
      );
    }
  };
}