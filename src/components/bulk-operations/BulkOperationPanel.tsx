import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useUndo } from '@/hooks/useUndo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Trash2, 
  Archive, 
  CheckSquare, 
  AlertTriangle,
  FileDown,
  RefreshCw,
  Copy,
  Tag
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { showToast, showUndoToast } from '@/lib/toast';
import { storage } from '@/lib/storage';
import { LoadingState } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';
import { logger } from '@/services/logger';
import type { Installation, Project } from '@/types';
import type { BulkOperation, BulkOperationPanelProps, BulkProgress, BulkItem } from './BulkOperationPanel.types';
import { getItemDisplayName } from './BulkOperationPanel.utils';

export function BulkOperationPanel({
  items,
  itemType,
  onItemsChange,
  className 
}: BulkOperationPanelProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingOperation, setPendingOperation] = useState<BulkOperation | null>(null);
  const [progress, setProgress] = useState<BulkProgress | null>(null);
  const { toast } = useToast();
  const { addAction, undo } = useUndo();

  // Define operations based on item type
  const getOperations = (): BulkOperation[] => {
    const baseOperations: BulkOperation[] = [
      {
        id: 'export-selected',
        label: 'Exportar Selecionados',
        icon: FileDown,
        description: 'Exportar itens selecionados para Excel',
        category: 'export',
        action: async (_items: BulkItem[]) => {
          // Mock export functionality
          await new Promise(resolve => setTimeout(resolve, 2000));
          const blob = new Blob(['Mock CSV data'], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${itemType}-export-${new Date().toISOString().split('T')[0]}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        }
      },
      {
        id: 'duplicate-selected',
        label: 'Duplicar Selecionados',
        icon: Copy,
        description: 'Criar cópias dos itens selecionados',
        category: 'organize',
        action: async (items: BulkItem[]) => {
          const duplicatedIds: string[] = [];

          if (itemType === 'projects') {
            const projectItems = items as Project[];

            for (const item of projectItems) {
              const duplicateId = `${item.id}_copy_${Date.now()}`;
              const duplicate: Project = {
                ...item,
                id: duplicateId,
                name: `${item.name} - Cópia`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };

              await storage.upsertProject(duplicate);
              duplicatedIds.push(duplicateId);
            }
          } else if (itemType === 'installations') {
            const installationItems = items as Installation[];

            for (const item of installationItems) {
              const duplicateId = `${item.id}_copy_${Date.now()}`;
              const duplicate: Installation = {
                ...item,
                id: duplicateId,
                descricao: `${item.descricao} - Cópia`,
                updated_at: new Date().toISOString()
              };

              await storage.upsertInstallation(duplicate);
              duplicatedIds.push(duplicateId);
            }
          }

          // Add undo action for duplication
          addAction({
            type: 'BULK_UPDATE',
            description: `Duplicou ${duplicatedIds.length} ${itemType === 'installations' ? 'instalação(ões)' : 'projeto(s)'}`,
            data: {
              itemType,
              newItemIds: duplicatedIds as string[]
            },
              undo: async () => {
              // Delete duplicated items
              for (const id of duplicatedIds) {
                if (itemType === 'projects') {
                  await storage.deleteProject(id);
                } else if (itemType === 'installations') {
                  await storage.deleteInstallation(id);
                }
              }

              // Refresh the list
              if (itemType === 'projects') {
                onItemsChange?.(await storage.getProjects());
              } else if (itemType === 'installations') {
                // Get projectId from first original item
                const projectId = (items as Installation[])[0]?.project_id;
                if (projectId && onItemsChange) {
                  const updatedInstallations = await storage.getInstallationsByProject(projectId);
                  onItemsChange(updatedInstallations);
                }
              }
            }
          });
          
          // Show undo toast
          showUndoToast(
            `Duplicou ${duplicatedIds.length} ${itemType === 'installations' ? 'instalação(ões)' : 'projeto(s)'}`,
            async () => {
              await undo();
            }
          );
          
          if (itemType === 'projects') {
            onItemsChange?.(await storage.getProjects());
          } else if (itemType === 'installations') {
            // Get projectId from first item
            const projectId = (items as Installation[])[0]?.project_id;
            if (projectId && onItemsChange) {
              const updatedInstallations = await storage.getInstallationsByProject(projectId);
              onItemsChange(updatedInstallations);
            }
          }
        }
      }
    ];

    // Add type-specific operations
    if (itemType === 'installations') {
      baseOperations.push(
        {
          id: 'mark-as-installed',
          label: 'Marcar como Instalado',
          icon: CheckSquare,
          description: 'Marcar instalações selecionadas como instaladas',
          category: 'organize',
          action: async (items) => {
            const installationItems = items as Installation[];
            // Save previous states before update
            const previousStates = installationItems.map(item => ({
              id: item.id,
              installed: item.installed,
              installed_at: item.installed_at
            }));

            // Update all items to installed
            for (const item of installationItems) {
              await storage.upsertInstallation({
                ...item,
                installed: true,
                installed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
            }
            
            // Add undo action
            addAction({
              type: 'BULK_UPDATE',
              description: `Marcou ${installationItems.length} instalação(ões) como instaladas`,
              data: {
                installationIds: installationItems.map((item) => item.id),
                previousStates
              },
              undo: async () => {
                // Restore previous state of each item
                for (const prevState of previousStates) {
                  const item = installationItems.find((i) => i.id === prevState.id);
                  if (item) {
                    await storage.upsertInstallation({
                      ...item,
                      installed: prevState.installed,
                      installed_at: prevState.installed_at,
                      updated_at: new Date().toISOString()
                    });
                  }
                }

                // Refresh the list
                const projectId = installationItems[0]?.project_id;
                if (projectId && onItemsChange) {
                  const updatedInstallations = await storage.getInstallationsByProject(projectId);
                  onItemsChange(updatedInstallations);
                }
              }
            });

            // Show undo toast
            showUndoToast(
              `Marcou ${installationItems.length} instalação(ões) como instaladas`,
              async () => {
                await undo();
              }
            );

            // Refresh the list
            const projectId = installationItems[0]?.project_id;
            if (projectId && onItemsChange) {
              const updatedInstallations = await storage.getInstallationsByProject(projectId);
              onItemsChange(updatedInstallations);
            }
          }
        }
      );
    }
    
    if (itemType === 'projects') {
      baseOperations.push(
        {
          id: 'sync-selected',
          label: 'Sincronizar Selecionados',
          icon: RefreshCw,
          description: 'Sincronizar projetos selecionados com o servidor',
          category: 'sync',
          action: async (items) => {
            // Mock sync functionality
            const projectItems = items as Project[];

            for (let i = 0; i < projectItems.length; i++) {
              setProgress(prev => prev ? {
                ...prev,
                completed: i + 1,
                current: getItemDisplayName(projectItems[i])
              } : null);
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        },
        {
          id: 'archive-selected',
          label: 'Arquivar Selecionados',
          icon: Archive,
          description: 'Mover projetos para arquivo (não serão excluídos)',
          category: 'organize',
          requiresConfirmation: true,
          action: async (items) => {
            // Save previous states before archiving
            const projectItems = items as Project[];
            const previousStates = projectItems.map(item => ({
              id: item.id,
              status: item.status
            }));

            for (const item of projectItems) {
              await storage.upsertProject({
                ...item,
                status: 'archived' as any,
                updated_at: new Date().toISOString()
              });
            }
            
            // Add undo action
            addAction({
              type: 'BULK_UPDATE',
            description: `Arquivou ${projectItems.length} projeto(s)`,
              data: {
                projectIds: projectItems.map((item) => item.id),
                previousStates
              },
              undo: async () => {
                // Restore previous status of each project
                for (const prevState of previousStates) {
                  const item = projectItems.find((i) => i.id === prevState.id);
                  if (item) {
                    await storage.upsertProject({
                      ...item,
                      status: prevState.status,
                      updated_at: new Date().toISOString()
                    });
                  }
                }
                
                // Refresh the list
                onItemsChange?.(await storage.getProjects());
              }
            });
            
            // Show undo toast
            showUndoToast(
              `Arquivou ${projectItems.length} projeto(s)`,
              async () => {
                await undo();
              }
            );

            onItemsChange?.(await storage.getProjects());
          }
        },
        {
          id: 'change-status',
          label: 'Alterar Status',
          icon: Tag,
          description: 'Alterar status de múltiplos projetos',
          category: 'organize',
          action: async (_items) => {
            // This would open a status selection dialog
            toast({
              title: 'Função em desenvolvimento',
              description: 'A alteração de status em lote estará disponível em breve.'
            });
          }
        }
      );
    }

    // Destructive operations (always last)
    baseOperations.push({
      id: 'delete-selected',
      label: 'Excluir Selecionados',
      icon: Trash2,
      description: 'Excluir permanentemente os itens selecionados',
      category: 'data',
      destructive: true,
      requiresConfirmation: true,
      action: async (items) => {
        if (itemType === 'projects') {
          const projectItems = items as Project[];
          const deletedItems = [...projectItems];

          for (const item of projectItems) {
            await storage.deleteProject(item.id);
          }

          addAction({
            type: 'BULK_DELETE',
            description: `Deletou ${projectItems.length} projeto(s)`,
            data: {
              itemType,
              deletedItems
            },
            undo: async () => {
              for (const item of deletedItems) {
                await storage.upsertProject(item);
              }

              onItemsChange?.(await storage.getProjects());
            }
          });

          showUndoToast(
            `Deletou ${projectItems.length} projeto(s)`,
            async () => {
              await undo();
            }
          );

          onItemsChange?.(await storage.getProjects());
        } else if (itemType === 'installations') {
          const installationItems = items as Installation[];
          const deletedItems = [...installationItems];

          for (const item of installationItems) {
            await storage.deleteInstallation(item.id);
          }

          addAction({
            type: 'BULK_DELETE',
            description: `Deletou ${installationItems.length} instalação(ões)`,
            data: {
              itemType,
              deletedItems
            },
            undo: async () => {
              for (const item of deletedItems) {
                await storage.upsertInstallation(item);
              }

              const projectId = deletedItems[0]?.project_id;
              if (projectId && onItemsChange) {
                const updatedInstallations = await storage.getInstallationsByProject(projectId);
                onItemsChange(updatedInstallations);
              }
            }
          });

          showUndoToast(
            `Deletou ${installationItems.length} instalação(ões)`,
            async () => {
              await undo();
            }
          );

          const remainingInstallations = installationItems.filter(i => !selectedItems.includes(i.id));
          onItemsChange?.(remainingInstallations);
        }

        setSelectedItems([]);
      }
    });

    return baseOperations;
  };

  const operations = getOperations();

  const handleSelectAll = () => {
    if (selectedItems.length === items.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(items.map(item => item.id));
    }
  };

  const handleSelectItem = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleOperation = async (operation: BulkOperation) => {
    if (selectedItems.length === 0) {
      toast({
        title: 'Nenhum item selecionado',
        description: 'Selecione ao menos um item antes de executar esta operação',
        variant: 'destructive',
        duration: 4000
      });
      showToast.error('Nenhum item selecionado', 'Selecione pelo menos um item para continuar.');
      return;
    }

    if (operation.requiresConfirmation) {
      setPendingOperation(operation);
      setShowConfirmDialog(true);
      return;
    }

    await executeOperation(operation);
  };

  const executeOperation = async (operation: BulkOperation) => {
    const selectedItemsData = items.filter(item => selectedItems.includes(item.id));
    
    try {
      setIsProcessing(true);
      setProgress({
        total: selectedItemsData.length,
        completed: 0,
        errors: []
      });

      await operation.action(selectedItemsData);

      const itemWord = selectedItemsData.length === 1 ? 'item' : 'itens';
      toast({
        title: 'Operação concluída com sucesso',
        description: `${operation.label} aplicada a ${selectedItemsData.length} ${itemWord}`,
        duration: 3000
      });
      showToast.success(
        'Operação concluída',
        `${operation.label} executada com sucesso para ${selectedItemsData.length} item(ns).`
      );

      setSelectedItems([]);
    } catch (error) {
      console.error('[BulkOperationPanel] Falha na operação em lote:', error, {
        operation: operation.id,
        operationLabel: operation.label,
        itemCount: selectedItemsData.length,
        itemType
      });
      logger.error('Erro na operação em lote', {
        error,
        operation: operation.id,
        operationLabel: operation.label,
        itemCount: selectedItemsData.length,
        itemType,
        operacao: 'executeOperation'
      });
      toast({
        title: 'Erro na operação em lote',
        description: `Não foi possível executar "${operation.label}". Tente novamente`,
        variant: 'destructive',
        duration: 5000
      });
      showToast.error('Erro na operação', `Falha ao executar ${operation.label.toLowerCase()}.`);
    } finally {
      setIsProcessing(false);
      setProgress(null);
      setShowConfirmDialog(false);
      setPendingOperation(null);
    }
  };

  const getOperationsByCategory = () => {
    return {
      organize: operations.filter(op => op.category === 'organize'),
      sync: operations.filter(op => op.category === 'sync'),
      export: operations.filter(op => op.category === 'export'),
      data: operations.filter(op => op.category === 'data')
    };
  };

  const operationsByCategory = getOperationsByCategory();
  const selectedCount = selectedItems.length;
  const allSelected = selectedItems.length === items.length && items.length > 0;

  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <Card className={cn("", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Operações em Lote</CardTitle>
              <CardDescription>
                Gerencie múltiplos {itemType === 'projects' ? 'projetos' : 'itens'} simultaneamente
              </CardDescription>
            </div>
            <Badge variant={selectedCount > 0 ? "default" : "secondary"}>
              {selectedCount} selecionado{selectedCount !== 1 ? 's' : ''}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Selection Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox 
                checked={allSelected}
                onCheckedChange={handleSelectAll}
                disabled={isProcessing}
              />
              <span className="text-sm font-medium">
                {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
              </span>
            </div>
            
            {selectedCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedItems([])}
                disabled={isProcessing}
              >
                Limpar seleção
              </Button>
            )}
          </div>

          {/* Progress */}
          {progress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processando...</span>
                <span>{progress.completed}/{progress.total}</span>
              </div>
              <Progress value={(progress.completed / progress.total) * 100} />
              {progress.current && (
                <p className="text-xs text-muted-foreground">
                  Processando: {progress.current}
                </p>
              )}
            </div>
          )}

          {/* Item List */}
          {selectedCount > 0 && (
            <div className="border rounded-lg">
              <ScrollArea className="h-32">
                <div className="p-2 space-y-1">
                  {items.filter(item => selectedItems.includes(item.id)).map(item => (
                    <div key={item.id} className="flex items-center gap-2 text-sm p-1">
                      <Checkbox
                        checked={true}
                        onCheckedChange={() => handleSelectItem(item.id)}
                        disabled={isProcessing}
                      />
                      <span className="truncate">{getItemDisplayName(item)}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Operations */}
          <div className="space-y-3">
            {/* Organize Operations */}
            {operationsByCategory.organize.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-muted-foreground">Organizar</h4>
                <div className="grid grid-cols-2 gap-2">
                  {operationsByCategory.organize.map(operation => (
                    <Button
                      key={operation.id}
                      variant="outline"
                      size="sm"
                      className="justify-start gap-2 h-auto p-2"
                      onClick={() => handleOperation(operation)}
                      disabled={selectedCount === 0 || isProcessing}
                    >
                      <operation.icon className="h-4 w-4" />
                      <div className="text-left">
                        <div className="text-xs font-medium">{operation.label}</div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Sync Operations */}
            {operationsByCategory.sync.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-muted-foreground">Sincronização</h4>
                <div className="grid grid-cols-1 gap-2">
                  {operationsByCategory.sync.map(operation => (
                    <Button
                      key={operation.id}
                      variant="outline"
                      size="sm"
                      className="justify-start gap-2 h-auto p-2"
                      onClick={() => handleOperation(operation)}
                      disabled={selectedCount === 0 || isProcessing}
                    >
                      <operation.icon className="h-4 w-4" />
                      <div className="text-left">
                        <div className="text-xs font-medium">{operation.label}</div>
                        <div className="text-xs text-muted-foreground">{operation.description}</div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Export Operations */}
            {operationsByCategory.export.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-muted-foreground">Exportar</h4>
                <div className="grid grid-cols-1 gap-2">
                  {operationsByCategory.export.map(operation => (
                    <Button
                      key={operation.id}
                      variant="outline"
                      size="sm"
                      className="justify-start gap-2 h-auto p-2"
                      onClick={() => handleOperation(operation)}
                      disabled={selectedCount === 0 || isProcessing}
                    >
                      <operation.icon className="h-4 w-4" />
                      <div className="text-left">
                        <div className="text-xs font-medium">{operation.label}</div>
                        <div className="text-xs text-muted-foreground">{operation.description}</div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Destructive Operations */}
            {operationsByCategory.data.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-destructive">Ações Destrutivas</h4>
                <div className="grid grid-cols-1 gap-2">
                  {operationsByCategory.data.map(operation => (
                    <Button
                      key={operation.id}
                      variant={operation.destructive ? "destructive" : "outline"}
                      size="sm"
                      className="justify-start gap-2 h-auto p-2"
                      onClick={() => handleOperation(operation)}
                      disabled={selectedCount === 0 || isProcessing}
                    >
                      <operation.icon className="h-4 w-4" />
                      <div className="text-left">
                        <div className="text-xs font-medium">{operation.label}</div>
                        <div className="text-xs opacity-90">{operation.description}</div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Confirmar operação
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja {pendingOperation?.label.toLowerCase()} {selectedCount} item(ns)?
              {pendingOperation?.destructive && (
                <span className="block mt-2 text-destructive font-medium">
                  Esta ação não pode ser desfeita.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant={pendingOperation?.destructive ? "destructive" : "default"}
              onClick={() => pendingOperation && executeOperation(pendingOperation)}
              disabled={isProcessing}
            >
              {isProcessing ? <LoadingState message="Processando..." size="sm" /> : 'Confirmar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden checkboxes for individual items selection */}
      <div className="hidden">
        {items.map(item => (
          <Checkbox
            key={`hidden-${item.id}`}
            checked={selectedItems.includes(item.id)}
            onCheckedChange={() => handleSelectItem(item.id)}
          />
        ))}
      </div>
    </>
  );
}