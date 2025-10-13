import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BlockingOverlayProps {
  isVisible: boolean;
  message?: string;
  progress?: {
    current: number;
    total: number;
    label?: string;
  };
  className?: string;
}

/**
 * Overlay bloqueante para operações críticas que não devem ser interrompidas
 * Usado em: uploads múltiplos, geração de relatórios, importação de dados
 */
export function BlockingOverlay({ 
  isVisible, 
  message = 'Processando...', 
  progress,
  className 
}: BlockingOverlayProps) {
  if (!isVisible) return null;

  return (
    <div 
      className={cn(
        "fixed inset-0 bg-black/50 z-50 flex items-center justify-center",
        className
      )}
      role="alert"
      aria-live="assertive"
      aria-busy="true"
    >
      <div className="bg-background p-6 rounded-lg shadow-lg flex flex-col items-center gap-4 min-w-[300px] max-w-md">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        
        <div className="text-center space-y-2">
          <p className="font-medium text-lg">{message}</p>
          
          {progress && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{progress.label || 'Progresso'}</span>
                <span>{progress.current} de {progress.total}</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-primary h-full transition-all duration-300 ease-out"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {Math.round((progress.current / progress.total) * 100)}% concluído
              </p>
            </div>
          )}
          
          <p className="text-sm text-muted-foreground">
            Por favor, não feche esta janela
          </p>
        </div>
      </div>
    </div>
  );
}
