import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Installation, ItemVersion } from "@/types";
import { Clock, Eye, X, ChevronUp } from "lucide-react";
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

  const handleRestore = async () => {
    if (!versionToRestore) return;

    setIsRestoring(true);
    setRestoringVersionId(versionToRestore.id);
    try {
      await onRestore(versionToRestore);
      setVersionToRestore(null);
      onClose();
    } catch (error) {
      console.error("Erro ao restaurar versão:", error);
    } finally {
      setIsRestoring(false);
      setRestoringVersionId(null);
    }
  };

  const getRevisionTypeKey = (revision: ItemVersion) => revision.type || revision.motivo;

  const getChangeTypeLabel = (revision: ItemVersion) => {
    const typeKey = getRevisionTypeKey(revision);
    const labels: Record<string, string> = {
      'problema-instalacao': 'Problema de Instalação',
      'revisao-conteudo': 'Revisão de Conteúdo',
      'desaprovado-cliente': 'Desaprovado pelo Cliente',
      'outros': 'Outros',
      'created': 'Criado',
      'edited': 'Editado',
      'restored': 'Restaurado',
    };
    return labels[typeKey] || typeKey;
  };

  const getChangeTypeBadge = (revision: ItemVersion) => {
    const typeKey = getRevisionTypeKey(revision);
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", className: string }> = {
      'problema-instalacao': { variant: "destructive", className: "bg-red-100 text-red-800 border-red-300" },
      'revisao-conteudo': { variant: "default", className: "bg-blue-100 text-blue-800 border-blue-300" },
      'desaprovado-cliente': { variant: "secondary", className: "bg-orange-100 text-orange-800 border-orange-300" },
      'outros': { variant: "outline", className: "bg-gray-100 text-gray-800 border-gray-300" },
      'created': { variant: "default", className: "bg-green-100 text-green-800 border-green-300" },
      'edited': { variant: "secondary", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
      'restored': { variant: "outline", className: "bg-purple-100 text-purple-800 border-purple-300" },
    };

    const badgeConfig = variants[typeKey] || variants['outros'];

    return (
      <Badge variant={badgeConfig.variant} className={badgeConfig.className}>
        {getChangeTypeLabel(revision)}
      </Badge>
    );
  };

  // Sort revisions by date (most recent first)
  const sortedRevisions = [...revisions].sort((a, b) => 
    new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
  );

  // Helper to get previous revision
  const getPreviousRevision = (currentIndex: number): ItemVersion | null => {
    // Next item in the sorted array is the previous revision (older)
    return sortedRevisions[currentIndex + 1] || null;
  };

  // Toggle expansion
  const toggleExpansion = (versionId: string) => {
    setExpandedVersionId(expandedVersionId === versionId ? null : versionId);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
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
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <ScrollArea className="h-[calc(90vh-120px)] pr-4">
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
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />
                
                <div className="space-y-6">
                  {sortedRevisions.map((revision, index) => {
                    const isExpanded = expandedVersionId === revision.id;
                    const previousRevision = getPreviousRevision(index);
                    
                    return (
                      <div key={revision.id} className="relative pl-14">
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
                                      Revisão {revision.revisao}
                                    </span>
                                    {getChangeTypeBadge(revision)}
                                  </div>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Clock className="h-4 w-4" />
                                    <span>
                                      {format(new Date(revision.criadoEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                    </span>
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
        onOpenChange={(open) => {
          if (!open && !isRestoring) {
            setVersionToRestore(null);
          }
        }}
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
