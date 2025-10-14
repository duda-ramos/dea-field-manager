import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatConflictDate, getRecordPreview } from '@/lib/conflictUtils';

export interface EditConflictAlertProps {
  conflictInfo: {
    recordType: string;
    recordName: string;
    localVersion: any;
    remoteVersion: any;
  };
  isOpen: boolean;
  onClose: () => void;
  onResolve: (useLocal: boolean) => void;
  isResolving?: boolean;
}

export function EditConflictAlert({
  conflictInfo,
  isOpen,
  onClose,
  onResolve,
  isResolving = false,
}: EditConflictAlertProps) {
  const { recordType, recordName, localVersion, remoteVersion } = conflictInfo;

  const localPreview = getRecordPreview(recordType, localVersion);
  const remotePreview = getRecordPreview(recordType, remoteVersion);

  const handleResolve = (useLocal: boolean) => {
    onResolve(useLocal);
    onClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-3xl">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            <AlertDialogTitle>Edição Simultânea Detectada</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            Este registro foi editado por outro usuário enquanto você estava trabalhando.
            Escolha qual versão deseja manter:
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="mt-6 space-y-4">
          <p className="text-sm font-medium">
            Registro: <span className="text-muted-foreground">{recordName}</span>
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Versão Local */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Sua Versão</CardTitle>
                  <Badge variant="default">Local</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Editado em {formatConflictDate(localVersion.updated_at)}
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(localPreview).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{key}:</span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={() => handleResolve(true)}
                  className="mt-4 w-full"
                  variant="default"
                  disabled={isResolving}
                >
                  {isResolving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    'Manter Minha Versão'
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Versão Remota */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Versão Remota</CardTitle>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Remoto
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Editado em {formatConflictDate(remoteVersion.updated_at)}
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(remotePreview).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{key}:</span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={() => handleResolve(false)}
                  className="mt-4 w-full"
                  variant="secondary"
                  disabled={isResolving}
                >
                  {isResolving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    'Usar Versão Remota'
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-center pt-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={isResolving}>
              Decidir Mais Tarde
            </Button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}