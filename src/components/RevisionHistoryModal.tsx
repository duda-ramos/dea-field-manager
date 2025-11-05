import { useState, useMemo, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Installation, ItemVersion, RevisionActionType } from "@/types";
import { Clock, Eye, X, ChevronUp, Download } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { VersionDiffView } from "./VersionDiffView";

interface RevisionHistoryModalProps {
  installation: Installation;
  revisions: ItemVersion[];
  isOpen: boolean;
  onClose: () => void;
  onRestore: (version: ItemVersion) => Promise<void>;
}

export function RevisionHistoryModal({
  installation,
  revisions,
  isOpen,
  onClose,
  onRestore,
}: RevisionHistoryModalProps) {
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  const [versionToRestore, setVersionToRestore] = useState<ItemVersion | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<'all' | RevisionActionType>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const UNKNOWN_USER_OPTION = '__unknown__';

  const handleRestore = useCallback(async () => {
    if (!versionToRestore) return;

    setIsRestoring(true);
    setRestoringVersionId(versionToRestore.id);
    try {
      await onRestore(versionToRestore);
      setVersionToRestore(null);
      onClose();
    } catch (_error) {
      console.error('[RevisionHistoryModal] Falha ao restaurar versão:', _error, {
        versionId: versionToRestore.id,
        versionRevisao: versionToRestore.revisao,
        installationId: installation.id,
        installationCode: installation.codigo
      });
      // Erro já é tratado pelo componente pai
    } finally {
      setIsRestoring(false);
      setRestoringVersionId(null);
    }
  }, [versionToRestore, onRestore, onClose]);

  // Memoize labels object to avoid recreation
  const changeTypeLabels = useMemo(() => ({
    'problema-instalacao': 'Problema de Instalação',
    'revisao-conteudo': 'Revisão de Conteúdo',
    'desaprovado-cliente': 'Desaprovado pelo Cliente',
    'outros': 'Outros',
    'created': 'Criado',
    'edited': 'Editado',
    'restored': 'Restaurado',
    'deleted': 'Excluído',
    'installed': 'Instalado',
  }), []);

  const getRevisionTypeKey = useCallback((revision: ItemVersion) => {
    if (revision.action_type) {
      return revision.action_type;
    }
    if (revision.type) {
      return revision.type;
    }
    return revision.motivo;
  }, []);

  const getChangeTypeLabel = useCallback((revision: ItemVersion) => {
    const typeKey = getRevisionTypeKey(revision);
    return changeTypeLabels[typeKey as keyof typeof changeTypeLabels] || typeKey;
  }, [getRevisionTypeKey, changeTypeLabels]);

  const actionLabels = useMemo<Record<RevisionActionType, string>>(() => ({
    created: 'Criado',
    updated: 'Atualizado',
    deleted: 'Excluído',
    installed: 'Instalado',
  }), []);

  const resolveActionType = useCallback((revision: ItemVersion): RevisionActionType => {
    if (revision.action_type) {
      return revision.action_type;
    }
    if (revision.type === 'created' || revision.motivo === 'created') {
      return 'created';
    }
    if (revision.type === 'deleted' || revision.motivo === 'deleted') {
      return 'deleted';
    }
    if (revision.type === 'installed' || revision.motivo === 'installed') {
      return 'installed';
    }
    return 'updated';
  }, []);

  const fieldLabels = useMemo(() => ({
    tipologia: 'Tipologia',
    codigo: 'Código',
    descricao: 'Descrição',
    quantidade: 'Quantidade',
    pavimento: 'Pavimento',
    diretriz_altura_cm: 'Diretriz Altura (cm)',
    diretriz_dist_batente_cm: 'Diretriz Distância Batente (cm)',
    installed: 'Instalado',
    status: 'Status',
    pendencia_tipo: 'Pendência',
    pendencia_descricao: 'Detalhes da Pendência',
    observacoes: 'Observações',
    comentarios_fornecedor: 'Comentários',
    photos: 'Fotos',
    revisao: 'Revisão',
    revisado: 'Revisado',
    deleted: 'Excluído',
  }), []);

  const formatSummaryValue = useCallback((value: unknown): string => {
    if (value === null || typeof value === 'undefined') {
      return '—';
    }
    if (typeof value === 'boolean') {
      return value ? 'Sim' : 'Não';
    }
    if (Array.isArray(value)) {
      return String(value.length);
    }
    return String(value);
  }, []);

  const renderChangeSummary = useCallback((summary: ItemVersion['changes_summary']) => {
    if (!summary) {
      return null;
    }
    const entries = Object.entries(summary);
    if (entries.length === 0) {
      return null;
    }

    return (
      <div className="space-y-1 text-xs text-muted-foreground mt-2">
        {entries.slice(0, 3).map(([field, value]) => (
          <p key={field}>
            <span className="font-medium">{fieldLabels[field as keyof typeof fieldLabels] ?? field}:</span>{' '}
            {formatSummaryValue(value.before)} → {formatSummaryValue(value.after)}
          </p>
        ))}
        {entries.length > 3 && (
          <p className="italic">+{entries.length - 3} alterações</p>
        )}
      </div>
    );
  }, [fieldLabels, formatSummaryValue]);

  const summaryToCsvString = useCallback((summary: ItemVersion['changes_summary']) => {
    if (!summary) {
      return '';
    }

    return Object.entries(summary)
      .map(([field, value]) => {
        const label = fieldLabels[field as keyof typeof fieldLabels] ?? field;
        return `${label}: ${formatSummaryValue(value.before)} -> ${formatSummaryValue(value.after)}`;
      })
      .join(' | ');
  }, [fieldLabels, formatSummaryValue]);

  // Memoize badge variants to avoid recreation
  const badgeVariants = useMemo(() => ({
    'problema-instalacao': { variant: "destructive" as const, className: "bg-red-100 text-red-800 border-red-300" },
    'revisao-conteudo': { variant: "default" as const, className: "bg-blue-100 text-blue-800 border-blue-300" },
    'desaprovado-cliente': { variant: "secondary" as const, className: "bg-orange-100 text-orange-800 border-orange-300" },
    'outros': { variant: "outline" as const, className: "bg-gray-100 text-gray-800 border-gray-300" },
    'created': { variant: "default" as const, className: "bg-green-100 text-green-800 border-green-300" },
    'edited': { variant: "secondary" as const, className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
    'restored': { variant: "outline" as const, className: "bg-purple-100 text-purple-800 border-purple-300" },
    'deleted': { variant: "destructive" as const, className: "bg-rose-100 text-rose-800 border-rose-300" },
    'installed': { variant: "default" as const, className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  }), []);

  const getChangeTypeBadge = useCallback((revision: ItemVersion) => {
    const typeKey = getRevisionTypeKey(revision);
    const badgeConfig = badgeVariants[typeKey as keyof typeof badgeVariants] || badgeVariants['outros'];

    return (
      <Badge variant={badgeConfig.variant} className={badgeConfig.className}>
        {getChangeTypeLabel(revision)}
      </Badge>
    );
  }, [getRevisionTypeKey, getChangeTypeLabel, badgeVariants]);

  // Sort revisions by date (most recent first) - memoized
  const sortedRevisions = useMemo(() =>
    [...revisions].sort((a, b) =>
      new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
    ),
    [revisions]
  );

  const hasUnknownUser = useMemo(() =>
    revisions.some(revision => !revision.user_email || revision.user_email.trim() === ''),
    [revisions]
  );

  const uniqueUsers = useMemo(() => {
    const users = new Set<string>();
    revisions.forEach(revision => {
      const email = revision.user_email?.trim();
      if (email) {
        users.add(email);
      }
    });
    return Array.from(users).sort((a, b) => a.localeCompare(b));
  }, [revisions]);

  const uniqueActions = useMemo(() => {
    const set = new Set<RevisionActionType>();
    revisions.forEach(revision => {
      set.add(resolveActionType(revision));
    });
    const order: RevisionActionType[] = ['created', 'updated', 'installed', 'deleted'];
    return order.filter(action => set.has(action));
  }, [revisions, resolveActionType]);

  const filteredRevisions = useMemo(() => {
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59.999`) : null;

    return sortedRevisions.filter(revision => {
      const action = resolveActionType(revision);
      if (actionFilter !== 'all' && action !== actionFilter) {
        return false;
      }

      const normalizedUser = revision.user_email?.trim() || UNKNOWN_USER_OPTION;
      if (userFilter !== 'all') {
        if (userFilter === UNKNOWN_USER_OPTION && normalizedUser !== UNKNOWN_USER_OPTION) {
          return false;
        }
        if (userFilter !== UNKNOWN_USER_OPTION && normalizedUser !== userFilter) {
          return false;
        }
      }

      const createdAt = new Date(revision.criadoEm);
      if (start && createdAt < start) {
        return false;
      }
      if (end && createdAt > end) {
        return false;
      }

      return true;
    });
  }, [sortedRevisions, actionFilter, userFilter, startDate, endDate, resolveActionType, UNKNOWN_USER_OPTION]);

  useEffect(() => {
    if (expandedVersionId && !filteredRevisions.some(revision => revision.id === expandedVersionId)) {
      setExpandedVersionId(null);
    }
  }, [filteredRevisions, expandedVersionId]);

  const handleResetFilters = useCallback(() => {
    setActionFilter('all');
    setUserFilter('all');
    setStartDate('');
    setEndDate('');
  }, []);

  const handleExportCsv = useCallback(() => {
    if (filteredRevisions.length === 0) {
      return;
    }

    const header = ['Revisão', 'Data', 'Ação', 'Motivo', 'Descrição', 'Usuário', 'Resumo'];
    const rows = filteredRevisions.map(revision => {
      const action = resolveActionType(revision);
      const formattedDate = format(new Date(revision.criadoEm), "dd/MM/yyyy HH:mm", { locale: ptBR });
      const motivoLabel = getChangeTypeLabel(revision);
      const user = revision.user_email || 'Não informado';
      const summary = summaryToCsvString(revision.changes_summary);

      const rawRow = [
        String(revision.revisao ?? ''),
        formattedDate,
        actionLabels[action],
        motivoLabel,
        revision.descricao_motivo ?? '',
        user,
        summary
      ];

      return rawRow
        .map(value => {
          const normalized = value ?? '';
          if (/[";\n]/.test(normalized)) {
            return `"${normalized.replace(/"/g, '""')}"`;
          }
          return normalized;
        })
        .join(';');
    });

    const csvContent = [header.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `historico_${installation.codigo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredRevisions, resolveActionType, getChangeTypeLabel, summaryToCsvString, actionLabels, installation.codigo]);

  const filtersActive = actionFilter !== 'all' || userFilter !== 'all' || Boolean(startDate) || Boolean(endDate);

  // Helper to get previous revision
  const getPreviousRevision = useCallback((revisionId: string): ItemVersion | null => {
    const currentIndex = sortedRevisions.findIndex(revision => revision.id === revisionId);
    if (currentIndex === -1) {
      return null;
    }
    return sortedRevisions[currentIndex + 1] || null;
  }, [sortedRevisions]);

  // Toggle expansion - memoized
  const toggleExpansion = useCallback((versionId: string) => {
    setExpandedVersionId(current => current === versionId ? null : versionId);
  }, []);

  // Memoize dialog close handler
  const handleDialogClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Memoize restore dialog handlers
  const handleRestoreDialogChange = useCallback((open: boolean) => {
    if (!open && !isRestoring) {
      setVersionToRestore(null);
    }
  }, [isRestoring]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-4xl max-h-[90vh]" aria-label="Histórico de revisões">
          <DialogHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl font-semibold">
                  Histórico de Revisões - {installation.codigo}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {installation.descricao}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8"
                aria-label="Fechar histórico de revisões"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Fechar</span>
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ação</p>
                <Select
                  value={actionFilter}
                  onValueChange={(value) => setActionFilter(value as 'all' | RevisionActionType)}
                >
                  <SelectTrigger aria-label="Filtrar histórico por ação">
                    <SelectValue placeholder="Todas as ações" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {uniqueActions.map(action => (
                      <SelectItem key={action} value={action}>
                        {actionLabels[action]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Usuário</p>
                <Select
                  value={userFilter}
                  onValueChange={setUserFilter}
                >
                  <SelectTrigger aria-label="Filtrar histórico por usuário">
                    <SelectValue placeholder="Todos os usuários" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {hasUnknownUser && (
                      <SelectItem value={UNKNOWN_USER_OPTION}>Não identificado</SelectItem>
                    )}
                    {uniqueUsers.map(user => (
                      <SelectItem key={user} value={user}>
                        {user}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data inicial</p>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  aria-label="Filtrar histórico a partir de uma data"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data final</p>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  aria-label="Filtrar histórico até uma data"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-muted-foreground">
                Exibindo {filteredRevisions.length} de {sortedRevisions.length} revisões
              </p>
              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                <Button
                  variant="ghost"
                  onClick={handleResetFilters}
                  disabled={!filtersActive}
                >
                  Limpar filtros
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExportCsv}
                  disabled={filteredRevisions.length === 0}
                  aria-label="Exportar histórico completo para CSV"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar CSV
                </Button>
              </div>
            </div>
          </div>

          <ScrollArea className="h-[calc(90vh-120px)] pr-4" role="region" aria-label="Lista de revisões">
            {sortedRevisions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="h-16 w-16 text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  Nenhuma revisão registrada
                </h3>
                <p className="text-sm text-muted-foreground">
                  As revisões desta instalação aparecerão aqui quando forem criadas.
                </p>
              </div>
            ) : filteredRevisions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  Nenhum resultado encontrado
                </h3>
                <p className="text-sm text-muted-foreground">
                  Ajuste os filtros para visualizar outros registros do histórico.
                </p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

                <div className="space-y-6" role="list">
                  {filteredRevisions.map((revision) => {
                    const isExpanded = expandedVersionId === revision.id;
                    const previousRevision = getPreviousRevision(revision.id);
                    const actionLabel = actionLabels[resolveActionType(revision)];
                    const userLabel = revision.user_email || 'Usuário não identificado';

                    return (
                      <div key={revision.id} className="relative pl-14" role="listitem" aria-label={`Revisão ${revision.revisao}`}>
                        {/* Timeline dot */}
                        <div className="absolute left-4 top-6 h-5 w-5 rounded-full border-4 border-background bg-primary" />
                        
                        <Card className="shadow-sm hover:shadow-md transition-shadow">
                          <CardContent className="pt-6">
                            <div className="space-y-4">
                              {/* Header */}
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-lg">
                                      {revision.revisao === 0 ? 'Versão Inicial (Revisão 0)' : `Revisão ${revision.revisao}`}
                                    </span>
                                    {getChangeTypeBadge(revision)}
                                  </div>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Clock className="h-4 w-4" />
                                    <span>
                                      {format(new Date(revision.criadoEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <span>{actionLabel}</span>
                                    <span className="hidden sm:inline">•</span>
                                    <span>{userLabel}</span>
                                  </div>
                                  {revision.descricao_motivo && (
                                    <p className="text-sm text-muted-foreground mt-2">
                                      {revision.descricao_motivo}
                                    </p>
                                  )}
                                </div>
                                
                                {/* Action buttons */}
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => toggleExpansion(revision.id)}
                                    aria-label={isExpanded ? "Ocultar detalhes" : "Ver detalhes"}
                                    aria-expanded={isExpanded}
                                  >
                                    {isExpanded ? (
                                      <>
                                        <ChevronUp className="h-4 w-4 mr-2" />
                                        Ocultar
                                      </>
                                    ) : (
                                      <>
                                        <Eye className="h-4 w-4 mr-2" />
                                        Ver Detalhes
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>

                              {/* Quick preview */}
                              {!isExpanded && (
                                <div className="grid grid-cols-3 gap-3 pt-3 border-t text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Tipologia:</span>
                                    <p className="font-medium truncate">{revision.snapshot.tipologia}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Quantidade:</span>
                                    <p className="font-medium">{revision.snapshot.quantidade}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Pavimento:</span>
                                    <p className="font-medium truncate">{revision.snapshot.pavimento}</p>
                                  </div>
                                </div>
                              )}

                              {!isExpanded && renderChangeSummary(revision.changes_summary)}

                              {/* Expanded diff view */}
                              {isExpanded && (
                                <VersionDiffView
                                  currentRevision={revision.snapshot}
                                  previousRevision={previousRevision?.snapshot || null}
                                  onRestore={() => setVersionToRestore(revision)}
                                  isCurrentVersion={revision.revisao === installation.revisao}
                                  isRestoring={restoringVersionId === revision.id && isRestoring}
                                />
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog
        open={!!versionToRestore}
        onOpenChange={handleRestoreDialogChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar Versão?</AlertDialogTitle>
            <AlertDialogDescription>
              Os dados da instalação voltarão para esta versão. Uma nova revisão será criada no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoring}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore} disabled={isRestoring}>
              {isRestoring ? "Restaurando..." : "Restaurar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
