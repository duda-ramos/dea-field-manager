import { useState } from "react";
import { Archive, Download, RotateCcw, Trash2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUndo } from "@/hooks/useUndo";
import { showUndoToast } from "@/lib/toast";
import { storage } from "@/lib/storage";
import { fullSync } from "@/services/sync/sync";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  softDeleteProject,
  archiveProject,
  restoreProject,
  permanentlyDeleteProject,
  downloadProjectZip,
} from "@/services/projectLifecycle";
import type { Project } from "@/types";

interface ProjectLifecycleActionsProps {
  project: Project;
  onUpdate: () => void;
}

export function ProjectLifecycleActions({ project, onUpdate }: ProjectLifecycleActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showPermanentDeleteDialog, setShowPermanentDeleteDialog] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { addAction, undo } = useUndo();
  const { toast } = useToast();

  const isDeleted = !!project.deleted_at;
  const isArchived = !!project.archived_at && !project.deleted_at;

  const handleSoftDelete = async () => {
    // Save complete project state before deletion
    const projectCopy = { ...project };
    
    await softDeleteProject(project.id);
    
    // Add undo action
    addAction({
      type: 'DELETE_PROJECT',
      description: `Deletou projeto "${projectCopy.name}"`,
      data: { deletedProject: projectCopy },
      undo: async () => {
        // Restaurar estado remoto antes de atualizar storage local
        await restoreProject(projectCopy.id);

        // Garantir que os campos de deleção sejam limpos localmente
        await storage.upsertProject({
          ...projectCopy,
          deleted_at: null,
          permanent_deletion_at: null,
        });
        // Atualizar UI
        onUpdate();
      }
    });
    
    // Show undo toast
    showUndoToast(
      `Deletou projeto "${projectCopy.name}"`,
      async () => {
        await undo();
      }
    );
    
    setShowDeleteDialog(false);
    onUpdate();
  };

  const handleArchive = async () => {
    // First download the ZIP, then archive
    setIsDownloading(true);
    const result = await downloadProjectZip(project.id);
    setIsDownloading(false);
    
    if (result.success) {
      await archiveProject(project.id);
      setShowArchiveDialog(false);
      onUpdate();
    }
  };

  const handleRestore = async () => {
    await restoreProject(project.id);
    onUpdate();
  };

  const handlePermanentDelete = async () => {
    await permanentlyDeleteProject(project.id);
    setShowPermanentDeleteDialog(false);
    onUpdate();
  };

  const handleDownloadZip = async () => {
    setIsDownloading(true);
    await downloadProjectZip(project.id);
    setIsDownloading(false);
  };

  const handleForceSync = async () => {
    setIsSyncing(true);
    try {
      const result = await fullSync();
      
      const pushTotals = Object.values(result.push).reduce((acc, entityResult) => {
        if (entityResult) {
          acc.pushed += entityResult.pushed || 0;
          acc.deleted += entityResult.deleted || 0;
        }
        return acc;
      }, { pushed: 0, deleted: 0 });

      const pullTotals = Object.values(result.pull).reduce((acc, entityResult) => {
        if (entityResult) {
          acc.pulled += entityResult.pulled || 0;
        }
        return acc;
      }, { pulled: 0 });

      const totalItems = pushTotals.pushed + pullTotals.pulled;
      const hasChanges = totalItems > 0 || pushTotals.deleted > 0;
      
      if (hasChanges) {
        const details = [];
        if (pushTotals.pushed > 0) details.push(`${pushTotals.pushed} enviados`);
        if (pullTotals.pulled > 0) details.push(`${pullTotals.pulled} recebidos`);
        if (pushTotals.deleted > 0) details.push(`${pushTotals.deleted} removidos`);
        
        toast({
          title: "Sincronização concluída",
          description: details.join(' • '),
          duration: 3000
        });
      } else {
        toast({
          title: "Tudo sincronizado",
          description: "Seus dados estão atualizados",
          duration: 2000
        });
      }
      
      onUpdate();
    } catch (error) {
      toast({
        title: "Erro na sincronização",
        description: "Não foi possível sincronizar. Verifique sua conexão",
        variant: "destructive",
        duration: 5000
      });
    } finally {
      setIsSyncing(false);
    }
  };

  if (isDeleted) {
    return (
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={handleRestore}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Restaurar
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => setShowPermanentDeleteDialog(true)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Excluir Permanentemente
        </Button>

        <AlertDialog open={showPermanentDeleteDialog} onOpenChange={setShowPermanentDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Excluir Permanentemente?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Todos os dados do projeto serão perdidos permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handlePermanentDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir Permanentemente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  if (isArchived) {
    return (
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={handleRestore}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reativar
        </Button>
        <Button size="sm" variant="outline" onClick={handleDownloadZip} disabled={isDownloading}>
          <Download className="h-4 w-4 mr-2" />
          {isDownloading ? "Baixando..." : "Baixar ZIP"}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => setShowPermanentDeleteDialog(true)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Excluir
        </Button>

        <AlertDialog open={showPermanentDeleteDialog} onOpenChange={setShowPermanentDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Excluir Projeto Arquivado?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Certifique-se de ter feito o download dos dados antes de excluir.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handlePermanentDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Active project
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            Ações
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleForceSync} disabled={isSyncing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? "Sincronizando..." : "Sincronizar Agora"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleDownloadZip} disabled={isDownloading}>
            <Download className="h-4 w-4 mr-2" />
            {isDownloading ? "Baixando..." : "Baixar ZIP"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowArchiveDialog(true)}>
            <Archive className="h-4 w-4 mr-2" />
            Arquivar Projeto
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Mover para Lixeira
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mover para Lixeira?</AlertDialogTitle>
            <AlertDialogDescription>
              O projeto será movido para a lixeira e será excluído permanentemente em 7 dias. Você pode restaurá-lo antes disso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSoftDelete}>
              Mover para Lixeira
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar Projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              O projeto será marcado como concluído e um arquivo ZIP com todos os dados será baixado automaticamente. 
              Projetos arquivados são mantidos por 6 meses.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} disabled={isDownloading}>
              {isDownloading ? "Preparando..." : "Arquivar e Baixar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
