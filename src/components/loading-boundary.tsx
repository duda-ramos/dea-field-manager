import React from 'react';
import { PageLoadingState } from '@/components/ui/loading-spinner';
import { ErrorBoundary, errorMonitoring } from '@/services/errorMonitoring';
import { DefaultErrorFallback } from './loading-boundary-fallback';

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