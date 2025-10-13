import { Spinner } from './Spinner';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Standard loading state component with spinner and optional message
 * Use this for consistent loading feedback across the app
 */
export function LoadingState({ 
  message = 'Carregando...', 
  size = 'md',
  className 
}: LoadingStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-8', className)}>
      <Spinner size={size} />
      {message && (
        <p className="text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  );
}

/**
 * Blocking overlay for critical operations that should not be interrupted
 * Examples: bulk uploads, important saves, report generation
 */
interface BlockingOverlayProps {
  message?: string;
  submessage?: string;
  show: boolean;
}

export function BlockingOverlay({ 
  message = 'Processando...', 
  submessage = 'Por favor, aguarde',
  show 
}: BlockingOverlayProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-background p-6 rounded-lg shadow-lg flex flex-col items-center gap-4 max-w-sm mx-4">
        <Spinner size="lg" className="text-primary" />
        <div className="text-center">
          <p className="font-medium text-lg">{message}</p>
          <p className="text-sm text-muted-foreground">{submessage}</p>
        </div>
      </div>
    </div>
  );
}
