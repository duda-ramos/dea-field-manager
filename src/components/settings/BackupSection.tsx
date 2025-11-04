import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Download, Upload, HardDrive, AlertTriangle, CheckCircle2, Database } from 'lucide-react';
import { useAuth } from '@/hooks/useAuthContext';
import { toast } from 'sonner';
import {
  exportAllData,
  importBackup,
  downloadBackupFile,
  readBackupFile,
  calculateStorageUsage,
  type BackupData,
  type StorageUsage,
} from '@/lib/backup';

export function BackupSection() {
  const { user } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importMessage, setImportMessage] = useState('');
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);
  const [loadingStorage, setLoadingStorage] = useState(true);

  useEffect(() => {
    loadStorageUsage();
  }, []);

  const loadStorageUsage = async () => {
    try {
      setLoadingStorage(true);
      const usage = await calculateStorageUsage();
      setStorageUsage(usage);
    } catch (error) {
      console.error('Erro ao carregar uso de armazenamento:', error);
      toast.error('Erro ao calcular uso de armazenamento');
    } finally {
      setLoadingStorage(false);
    }
  };

  const handleExport = async () => {
    if (!user?.id) {
      toast.error('Usuário não autenticado');
      return;
    }

    try {
      setIsExporting(true);
      toast.info('Gerando backup...', { duration: 2000 });

      const backupData = await exportAllData(user.id);
      downloadBackupFile(backupData);

      toast.success(
        `Backup exportado com sucesso! ${backupData.metadata.totalRecords} registros incluídos.`
      );
    } catch (error) {
      console.error('Erro ao exportar backup:', error);
      toast.error(
        error instanceof Error ? error.message : 'Erro ao exportar backup'
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.json')) {
        toast.error('Por favor, selecione um arquivo JSON válido');
        return;
      }
      setSelectedFile(file);
      setShowImportDialog(true);
    }
  };

  const handleImport = async (clearExisting: boolean) => {
    if (!selectedFile) return;

    try {
      setIsImporting(true);
      setImportProgress(0);
      setImportMessage('Lendo arquivo...');

      const backupData: BackupData = await readBackupFile(selectedFile);

      setImportMessage('Validando dados...');
      await importBackup(backupData, {
        clearExisting,
        onProgress: (progress, message) => {
          setImportProgress(progress);
          setImportMessage(message);
        },
      });

      toast.success('Backup importado com sucesso!');
      setShowImportDialog(false);
      setSelectedFile(null);
      
      // Recarregar uso de armazenamento
      await loadStorageUsage();
    } catch (error) {
      console.error('Erro ao importar backup:', error);
      toast.error(
        error instanceof Error ? error.message : 'Erro ao importar backup'
      );
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      setImportMessage('');
    }
  };

  const formatBytes = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(2);
  };

  return (
    <div className="space-y-6">
      {/* Storage Usage Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Uso de Armazenamento
          </CardTitle>
          <CardDescription>
            Monitoramento do espaço usado no armazenamento local
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingStorage ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : storageUsage ? (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Espaço Usado</span>
                  <span className="font-medium">
                    {storageUsage.usedMB} MB / {storageUsage.estimatedTotalMB} MB
                  </span>
                </div>
                <Progress value={storageUsage.percentageUsed} className="h-2" />
                <p className="text-xs text-muted-foreground text-right">
                  {storageUsage.percentageUsed.toFixed(1)}% utilizado
                </p>
              </div>

              {storageUsage.isNearLimit && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Atenção! Você está utilizando mais de 80% do armazenamento
                    disponível. Considere exportar e limpar dados antigos.
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Projetos</p>
                  <p className="text-sm font-medium">
                    {formatBytes(storageUsage.details.projects)} MB
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Instalações</p>
                  <p className="text-sm font-medium">
                    {formatBytes(storageUsage.details.installations)} MB
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Contatos</p>
                  <p className="text-sm font-medium">
                    {formatBytes(storageUsage.details.contacts)} MB
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Orçamentos</p>
                  <p className="text-sm font-medium">
                    {formatBytes(storageUsage.details.budgets)} MB
                  </p>
                </div>
              </div>
            </>
          ) : (
            <Alert>
              <AlertDescription>
                Não foi possível calcular o uso de armazenamento
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Backup & Restore Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Backup e Restauração
          </CardTitle>
          <CardDescription>
            Exporte e importe todos os seus dados do sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              O backup inclui todos os projetos, instalações, contatos,
              orçamentos e metadados de fotos. As fotos físicas permanecem no
              armazenamento do Supabase.
            </AlertDescription>
          </Alert>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="flex-1"
              variant="default"
            >
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? 'Exportando...' : 'Exportar Backup'}
            </Button>

            <Button
              onClick={() => document.getElementById('backup-file-input')?.click()}
              disabled={isImporting}
              className="flex-1"
              variant="outline"
            >
              <Upload className="h-4 w-4 mr-2" />
              {isImporting ? 'Importando...' : 'Importar Backup'}
            </Button>

            <input
              id="backup-file-input"
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar Backup</DialogTitle>
            <DialogDescription>
              Arquivo selecionado: <strong>{selectedFile?.name}</strong>
            </DialogDescription>
          </DialogHeader>

          {isImporting ? (
            <div className="space-y-4 py-4">
              <Progress value={importProgress} className="h-2" />
              <p className="text-sm text-center text-muted-foreground">
                {importMessage}
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Atenção:</strong> A importação com substituição
                  completa irá apagar todos os dados existentes. Esta ação não
                  pode ser desfeita.
                </AlertDescription>
              </Alert>

              <p className="text-sm text-muted-foreground">
                Escolha como deseja importar os dados:
              </p>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowImportDialog(false);
                setSelectedFile(null);
              }}
              disabled={isImporting}
            >
              Cancelar
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleImport(false)}
              disabled={isImporting}
            >
              Mesclar Dados
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleImport(true)}
              disabled={isImporting}
            >
              Substituir Tudo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
