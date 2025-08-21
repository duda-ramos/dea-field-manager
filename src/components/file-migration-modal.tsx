import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { CloudUpload, AlertTriangle, CheckCircle } from 'lucide-react';
import { storageService } from '@/services/storage';
import { useToast } from '@/hooks/use-toast';
import type { ProjectFile } from '@/types';

interface FileMigrationModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  legacyFiles: ProjectFile[];
  onMigrationComplete: () => void;
}

export function FileMigrationModal({ 
  isOpen, 
  onOpenChange, 
  legacyFiles, 
  onMigrationComplete 
}: FileMigrationModalProps) {
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState(0);
  const [migratedCount, setMigratedCount] = useState(0);
  const [failedFiles, setFailedFiles] = useState<string[]>([]);
  const [isOnline] = useState(navigator.onLine);
  const { toast } = useToast();

  const startMigration = async () => {
    setIsMigrating(true);
    setMigrationProgress(0);
    setMigratedCount(0);
    setFailedFiles([]);

    const totalFiles = legacyFiles.length;
    let completed = 0;

    for (const file of legacyFiles) {
      try {
        await storageService.migrateLegacyFile(file);
        completed++;
        setMigratedCount(completed);
        setMigrationProgress((completed / totalFiles) * 100);
      } catch (error) {
        console.error(`Failed to migrate file ${file.name}:`, error);
        setFailedFiles(prev => [...prev, file.name]);
      }
    }

    setIsMigrating(false);

    if (failedFiles.length === 0) {
      toast({
        title: "Migração concluída",
        description: `${totalFiles} arquivos foram migrados com sucesso para a nuvem.`
      });
    } else {
      toast({
        title: "Migração parcialmente concluída",
        description: `${completed} de ${totalFiles} arquivos migrados. ${failedFiles.length} falharam.`,
        variant: "destructive"
      });
    }

    onMigrationComplete();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CloudUpload className="h-5 w-5" />
            Migrar arquivos para nuvem
          </DialogTitle>
          <DialogDescription>
            {legacyFiles.length} arquivos locais foram encontrados. 
            Deseja enviá-los para a nuvem para acesso em outros dispositivos?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isOnline && (
            <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-orange-700 dark:text-orange-300">
                Você precisa estar online para migrar os arquivos.
              </span>
            </div>
          )}

          {isOnline && !isMigrating && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                ⚠️ Esta operação pode consumir dados móveis se você estiver usando conexão celular.
              </p>
            </div>
          )}

          {isOnline && !isMigrating && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Arquivos a serem migrados:</h4>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {legacyFiles.map((file) => (
                  <div key={file.id} className="flex items-center justify-between text-xs p-2 bg-muted rounded">
                    <span className="truncate">{file.name}</span>
                    <span className="text-muted-foreground ml-2">
                      {(file.size / 1024 / 1024).toFixed(1)}MB
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isMigrating && migrationProgress > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progresso da migração</span>
                <span>{migratedCount} de {legacyFiles.length}</span>
              </div>
              <Progress value={migrationProgress} className="h-2" />
            </div>
          )}

          {failedFiles.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-red-600">Arquivos que falharam:</h4>
              <div className="max-h-24 overflow-y-auto space-y-1">
                {failedFiles.map((fileName, index) => (
                  <div key={index} className="text-xs text-red-600 p-1 bg-red-50 dark:bg-red-950 rounded">
                    {fileName}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isMigrating}
            >
              {isMigrating ? "Aguarde..." : "Mais tarde"}
            </Button>
            <Button
              onClick={isMigrating ? undefined : startMigration}
              disabled={!isOnline || isMigrating}
              className="min-w-[120px]"
            >
              {isMigrating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Migrando...
                </>
              ) : migrationProgress === 100 ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Concluído
                </>
              ) : (
                <>
                  <CloudUpload className="h-4 w-4 mr-2" />
                  Migrar agora
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}