import { errorMonitoring } from '@/services/errorMonitoring';

// Hook para uso com componentes funcionais
export const useLoadingBoundary = () => {
  return {
    captureError: (error: Error, context?: Record<string, unknown>) => {
      errorMonitoring.captureComponentError(
        error,
        'FunctionalComponent',
        context
      );
    }
  };
};
