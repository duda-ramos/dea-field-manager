/**
 * ReportShareModal
 * 
 * Modal simplificado para download de relatórios.
 * Removidas funcionalidades de compartilhamento (Email, WhatsApp, Links públicos)
 * para manter apenas o download direto.
 * 
 * Refatorado em: 2025-10-15
 * Redução: ~242 linhas → ~65 linhas (73%)
 */

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Download } from 'lucide-react';
import { Project } from '@/types';
import { ReportConfig } from './ReportCustomizationModal';

interface ReportShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  blob: Blob;
  format: 'pdf' | 'xlsx';
  config: ReportConfig;
  project: Project;
  interlocutor: 'cliente' | 'fornecedor';
}

export function ReportShareModal({
  isOpen,
  onClose,
  blob,
  format,
  config: _config,
  project,
  interlocutor,
}: ReportShareModalProps) {
  const { toast } = useToast();

  // Nome do arquivo
  const fileName = `relatorio-${project.name
    .toLowerCase()
    .replace(/\s+/g, '-')}-${interlocutor}-${new Date().getTime()}.${format}`;

  const handleDownload = () => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Download realizado",
      description: `Relatório ${format.toUpperCase()} baixado com sucesso`,
    });

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Baixar Relatório</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Projeto: <span className="font-medium text-foreground">{project.name}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Para: <span className="font-medium text-foreground">
                {interlocutor === 'cliente' ? 'Cliente' : 'Fornecedor'}
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              Formato: <span className="font-medium text-foreground">{format.toUpperCase()}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Nome do arquivo: <span className="font-medium text-foreground break-all">{fileName}</span>
            </p>
          </div>

          <Button 
            onClick={handleDownload} 
            className="w-full gap-2"
            size="lg"
          >
            <Download className="h-5 w-5" />
            Baixar Relatório {format.toUpperCase()}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
