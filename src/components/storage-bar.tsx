import { cn } from "@/lib/utils";

interface StorageBarProps {
  instalados: number;
  pendentes: number;
  emAndamento: number;
  title?: string;
  size?: 'default' | 'mini';
  onSegmentClick?: (segment: 'instalados' | 'pendentes' | 'emAndamento') => void;
  className?: string;
}

const colors = {
  pendentes: '#F59E0B',
  emAndamento: '#6B7280',
  instalados: '#10B981',
  background: '#E5E7EB'
};

export function StorageBar({ 
  instalados,
  pendentes, 
  emAndamento,
  title,
  size = 'default',
  onSegmentClick,
  className 
}: StorageBarProps) {
  const total = instalados + pendentes + emAndamento;
  
  if (total === 0) {
    return (
      <div className={cn("w-full", className)}>
        {title && <div className="text-sm font-medium mb-2">{title}</div>}
        <div 
          className={cn(
            "w-full rounded-full bg-muted",
            size === 'mini' ? 'h-3' : 'h-5'
          )}
        />
        <div className="text-xs text-muted-foreground mt-2">
          Nenhum item encontrado
        </div>
      </div>
    );
  }
  
  const instaladosPercent = (instalados / total) * 100;
  const pendentesPercent = (pendentes / total) * 100;
  const emAndamentoPercent = (emAndamento / total) * 100;
  
  const barHeight = size === 'mini' ? 'h-3' : 'h-5';
  
  return (
    <div className={cn("w-full", className)}>
      {title && (
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium">{title}</div>
          {size === 'default' && (
            <div className="text-xs text-muted-foreground">
              Instalados {Math.round(instaladosPercent)}% ({instalados}) • 
              Pendentes {Math.round(pendentesPercent)}% ({pendentes}) • 
              Em Andamento {Math.round(emAndamentoPercent)}% ({emAndamento}) — 
              Total {total}
            </div>
          )}
        </div>
      )}
      
      <div className={cn("w-full rounded-full bg-muted flex overflow-hidden", barHeight)}>
        {/* Instalados */}
        {instalados > 0 && (
          <div
            className={cn(
              "transition-all duration-200 first:rounded-l-full",
              onSegmentClick && "cursor-pointer hover:opacity-80"
            )}
            style={{
              width: `${instaladosPercent}%`,
              backgroundColor: colors.instalados
            }}
            onClick={() => onSegmentClick?.('instalados')}
            role={onSegmentClick ? "button" : undefined}
            aria-label={`Instalados: ${instalados} itens (${Math.round(instaladosPercent)}%)`}
          />
        )}
        
        {/* Pendentes */}
        {pendentes > 0 && (
          <div
            className={cn(
              "transition-all duration-200",
              onSegmentClick && "cursor-pointer hover:opacity-80"
            )}
            style={{
              width: `${pendentesPercent}%`,
              backgroundColor: colors.pendentes,
              marginLeft: instalados > 0 ? '2px' : '0'
            }}
            onClick={() => onSegmentClick?.('pendentes')}
            role={onSegmentClick ? "button" : undefined}
            aria-label={`Pendentes: ${pendentes} itens (${Math.round(pendentesPercent)}%)`}
          />
        )}
        
        {/* Em Andamento */}
        {emAndamento > 0 && (
          <div
            className={cn(
              "transition-all duration-200 last:rounded-r-full",
              onSegmentClick && "cursor-pointer hover:opacity-80"
            )}
            style={{
              width: `${emAndamentoPercent}%`,
              backgroundColor: colors.emAndamento,
              marginLeft: (instalados > 0 || pendentes > 0) ? '2px' : '0'
            }}
            onClick={() => onSegmentClick?.('emAndamento')}
            role={onSegmentClick ? "button" : undefined}
            aria-label={`Em Andamento: ${emAndamento} itens (${Math.round(emAndamentoPercent)}%)`}
          />
        )}
      </div>
      
      {size === 'mini' && (
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: colors.instalados }}
            />
            {instalados}
          </div>
          <div className="flex items-center gap-1">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: colors.pendentes }}
            />
            {pendentes}
          </div>
          <div className="flex items-center gap-1">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: colors.emAndamento }}
            />
            {emAndamento}
          </div>
          <span className="font-medium">Total: {total}</span>
        </div>
      )}
    </div>
  );
}