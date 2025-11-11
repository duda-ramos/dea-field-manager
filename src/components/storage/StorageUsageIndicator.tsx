import { AlertCircle, HardDrive, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useStorageUsage, useStorageCleanup } from '@/hooks/useStorageUsage';
import { useState } from 'react';
import { toast } from 'sonner';

/**
 * Indicador visual de uso do IndexedDB
 * 
 * Problema resolvido: Usuários não sabem quando o storage está cheio
 * Solução: Indicador sempre visível com opções de limpeza
 */
export function StorageUsageIndicator() {
  const { percentage, formatUsed, formatQuota, isNearLimit, isAtLimit, loading, refresh } = useStorageUsage();
  const { clearOldData } = useStorageCleanup();
  const [cleaning, setCleaning] = useState(false);

  const handleCleanup = async () => {
    setCleaning(true);
    try {
      const result = await clearOldData();
      
      if (result.success) {
        toast.success(`Limpeza concluída! ${result.deletedCount} itens removidos.`);
        await refresh();
      } else {
        toast.error('Falha ao limpar armazenamento');
      }
    } catch (error) {
      toast.error('Erro durante limpeza');
    } finally {
      setCleaning(false);
    }
  };

  // Cor do indicador baseado no uso
  const getColor = () => {
    if (isAtLimit) return 'text-destructive';
    if (isNearLimit) return 'text-warning';
    return 'text-muted-foreground';
  };

  const getProgressColor = () => {
    if (isAtLimit) return 'bg-destructive';
    if (isNearLimit) return 'bg-warning';
    return 'bg-primary';
  };

  if (loading) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className={`gap-2 ${getColor()}`}
        >
          <HardDrive className="h-4 w-4" />
          <span className="text-xs font-mono">
            {percentage.toFixed(0)}%
          </span>
          {(isNearLimit || isAtLimit) && (
            <AlertCircle className="h-3 w-3" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Armazenamento Local</h4>
              <span className="text-xs text-muted-foreground">
                {formatUsed()} / {formatQuota()}
              </span>
            </div>
            
            <Progress 
              value={percentage} 
              className="h-2"
            />
            
            <p className="text-xs text-muted-foreground">
              {percentage.toFixed(1)}% utilizado
            </p>
          </div>

          {isAtLimit && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Armazenamento quase cheio! Faça limpeza para continuar.
              </AlertDescription>
            </Alert>
          )}

          {isNearLimit && !isAtLimit && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Armazenamento próximo do limite. Considere fazer limpeza.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Button
              onClick={handleCleanup}
              disabled={cleaning}
              variant="outline"
              size="sm"
              className="w-full gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {cleaning ? 'Limpando...' : 'Limpar Dados Antigos'}
            </Button>
            
            <p className="text-xs text-muted-foreground">
              Remove projetos deletados há mais de 30 dias
            </p>
          </div>

          <div className="text-xs space-y-1 text-muted-foreground border-t pt-2">
            <p><strong>Dica:</strong> O armazenamento local permite usar o app offline.</p>
            <p>Dados importantes são sincronizados com a nuvem.</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
