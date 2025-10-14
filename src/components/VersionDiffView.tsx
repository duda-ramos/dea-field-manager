import { useMemo, useCallback } from "react";
import { Installation } from "@/types";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VersionDiffViewProps {
  currentRevision: Omit<Installation, 'id' | 'revisado' | 'revisao'>;
  previousRevision: Omit<Installation, 'id' | 'revisado' | 'revisao'> | null;
  onRestore: () => void;
  isCurrentVersion: boolean;
  isRestoring?: boolean;
}

interface FieldComparison {
  label: string;
  currentValue: string | number | undefined;
  previousValue: string | number | undefined;
  hasChanged: boolean;
  showField: boolean;
}

export function VersionDiffView({
  currentRevision,
  previousRevision,
  onRestore,
  isCurrentVersion,
  isRestoring = false,
}: VersionDiffViewProps) {
  const isFirstVersion = !previousRevision;

  // Helper function to check if values are different - memoized
  const hasChanged = useCallback((current: unknown, previous: unknown): boolean => {
    if (current === previous) return false;
    if (current === null || current === undefined) return previous !== null && previous !== undefined;
    if (previous === null || previous === undefined) return current !== null && current !== undefined;
    return String(current) !== String(previous);
  }, []);

  // Helper function to check if a field should be shown - memoized
  const shouldShowField = useCallback((current: unknown, previous: unknown): boolean => {
    // Show if either value exists
    return (current !== null && current !== undefined && current !== '') ||
           (previous !== null && previous !== undefined && previous !== '');
  }, []);

  // Helper to format field value - memoized
  const formatValue = useCallback((value: unknown, defaultText: string = "—"): string => {
    if (value === null || value === undefined || value === '') return defaultText;
    return String(value);
  }, []);

  // Define all fields to compare - memoized
  const fields = useMemo<FieldComparison[]>(() => [
    {
      label: "Tipologia",
      currentValue: currentRevision.tipologia,
      previousValue: previousRevision?.tipologia,
      hasChanged: hasChanged(currentRevision.tipologia, previousRevision?.tipologia),
      showField: shouldShowField(currentRevision.tipologia, previousRevision?.tipologia)
    },
    {
      label: "Código",
      currentValue: currentRevision.codigo,
      previousValue: previousRevision?.codigo,
      hasChanged: hasChanged(currentRevision.codigo, previousRevision?.codigo),
      showField: shouldShowField(currentRevision.codigo, previousRevision?.codigo)
    },
    {
      label: "Descrição",
      currentValue: currentRevision.descricao,
      previousValue: previousRevision?.descricao,
      hasChanged: hasChanged(currentRevision.descricao, previousRevision?.descricao),
      showField: shouldShowField(currentRevision.descricao, previousRevision?.descricao)
    },
    {
      label: "Quantidade",
      currentValue: currentRevision.quantidade,
      previousValue: previousRevision?.quantidade,
      hasChanged: hasChanged(currentRevision.quantidade, previousRevision?.quantidade),
      showField: shouldShowField(currentRevision.quantidade, previousRevision?.quantidade)
    },
    {
      label: "Pavimento",
      currentValue: currentRevision.pavimento,
      previousValue: previousRevision?.pavimento,
      hasChanged: hasChanged(currentRevision.pavimento, previousRevision?.pavimento),
      showField: shouldShowField(currentRevision.pavimento, previousRevision?.pavimento)
    },
    {
      label: "Diretriz Altura (cm)",
      currentValue: currentRevision.diretriz_altura_cm,
      previousValue: previousRevision?.diretriz_altura_cm,
      hasChanged: hasChanged(currentRevision.diretriz_altura_cm, previousRevision?.diretriz_altura_cm),
      showField: shouldShowField(currentRevision.diretriz_altura_cm, previousRevision?.diretriz_altura_cm)
    },
    {
      label: "Diretriz Distância Batente (cm)",
      currentValue: currentRevision.diretriz_dist_batente_cm,
      previousValue: previousRevision?.diretriz_dist_batente_cm,
      hasChanged: hasChanged(currentRevision.diretriz_dist_batente_cm, previousRevision?.diretriz_dist_batente_cm),
      showField: shouldShowField(currentRevision.diretriz_dist_batente_cm, previousRevision?.diretriz_dist_batente_cm)
    },
    {
      label: "Status",
      currentValue: currentRevision.installed ? "Instalado" : "Pendente",
      previousValue: previousRevision?.installed ? "Instalado" : "Pendente",
      hasChanged: hasChanged(currentRevision.installed, previousRevision?.installed),
      showField: true
    },
    {
      label: "Observações",
      currentValue: currentRevision.observacoes,
      previousValue: previousRevision?.observacoes,
      hasChanged: hasChanged(currentRevision.observacoes, previousRevision?.observacoes),
      showField: shouldShowField(currentRevision.observacoes, previousRevision?.observacoes)
    },
    {
      label: "Comentários para Fornecedor",
      currentValue: currentRevision.comentarios_fornecedor,
      previousValue: previousRevision?.comentarios_fornecedor,
      hasChanged: hasChanged(currentRevision.comentarios_fornecedor, previousRevision?.comentarios_fornecedor),
      showField: shouldShowField(currentRevision.comentarios_fornecedor, previousRevision?.comentarios_fornecedor)
    },
    {
      label: "Número de Fotos",
      currentValue: currentRevision.photos?.length || 0,
      previousValue: previousRevision?.photos?.length || 0,
      hasChanged: hasChanged(currentRevision.photos?.length || 0, previousRevision?.photos?.length || 0),
      showField: true
    },
  ], [currentRevision, previousRevision, hasChanged, shouldShowField]);

  // Filter to show only relevant fields - memoized
  const visibleFields = useMemo(() => fields.filter(field => field.showField), [fields]);

  const restoreButton = (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between pt-4 border-t">
      <p className="text-xs text-muted-foreground">
        {isCurrentVersion
          ? "Esta já é a versão atual da instalação."
          : "Ao restaurar, os dados atuais serão substituídos por esta versão."}
      </p>
      <Button
        onClick={onRestore}
        disabled={isCurrentVersion || isRestoring}
        variant={isCurrentVersion ? "outline" : "default"}
      >
        {isRestoring ? "Restaurando..." : "Restaurar Esta Versão"}
      </Button>
    </div>
  );

  if (isFirstVersion) {
    // First version - show only current column
    return (
      <div className="space-y-4 mt-4 p-4 bg-muted/30 rounded-lg border">
        <div className="flex items-center gap-2 mb-4">
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Primeira Versão
          </Badge>
          <span className="text-sm text-muted-foreground">
            Esta é a versão inicial da instalação
          </span>
        </div>

        <div className="space-y-3">
          {visibleFields.map((field) => (
            <div key={field.label} className="grid grid-cols-1 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">{field.label}</Label>
                <div className="mt-1 p-2 bg-background rounded border text-sm">
                  {formatValue(field.currentValue)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {restoreButton}
      </div>
    );
  }

  // Comparison view - show both columns
  return (
    <div className="space-y-4 mt-4 p-4 bg-muted/30 rounded-lg border">
      <div className="flex items-center gap-2 mb-4">
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          Comparação de Versões
        </Badge>
        <span className="text-sm text-muted-foreground">
          Campos com alterações destacados
        </span>
      </div>

      {/* Header - Desktop */}
      <div className="hidden md:grid md:grid-cols-2 gap-4 pb-3 border-b">
        <div className="text-center">
          <span className="text-sm font-medium text-muted-foreground">Versão Anterior</span>
        </div>
        <div className="text-center">
          <span className="text-sm font-medium text-muted-foreground">Esta Versão</span>
        </div>
      </div>

      {/* Fields Comparison */}
      <div className="space-y-4">
        {visibleFields.map((field) => (
          <div key={field.label}>
            <Label className="text-xs text-muted-foreground mb-2 block">
              {field.label}
              {field.hasChanged && (
                <Badge variant="outline" className="ml-2 text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                  Alterado
                </Badge>
              )}
            </Label>
            
            {/* Desktop: Side by side */}
            <div className="hidden md:grid md:grid-cols-2 gap-4">
              <div
                className={cn(
                  "p-3 bg-background rounded border text-sm",
                  field.hasChanged && "border-yellow-400 bg-yellow-50/50"
                )}
              >
                {formatValue(field.previousValue)}
              </div>
              <div
                className={cn(
                  "p-3 bg-background rounded border text-sm font-medium",
                  field.hasChanged && "border-yellow-400 bg-yellow-50/50"
                )}
              >
                {formatValue(field.currentValue)}
              </div>
            </div>

            {/* Mobile: Stacked */}
            <div className="md:hidden space-y-2">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Versão Anterior</div>
                <div
                  className={cn(
                    "p-3 bg-background rounded border text-sm",
                    field.hasChanged && "border-yellow-400 bg-yellow-50/50"
                  )}
                >
                  {formatValue(field.previousValue)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Esta Versão</div>
                <div
                  className={cn(
                    "p-3 bg-background rounded border text-sm font-medium",
                    field.hasChanged && "border-yellow-400 bg-yellow-50/50"
                  )}
                >
                  {formatValue(field.currentValue)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary of changes */}
      <div className="pt-4 border-t">
        <div className="text-sm text-muted-foreground">
          {visibleFields.filter(f => f.hasChanged).length === 0 ? (
            <span>Nenhuma alteração detectada</span>
          ) : (
            <span>
              {visibleFields.filter(f => f.hasChanged).length} campo(s) alterado(s)
            </span>
          )}
        </div>
      </div>

      {restoreButton}
    </div>
  );
}
