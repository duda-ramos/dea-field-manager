/**
 * ReportShareModal
 * 
 * Modal simplificado para download de relatórios.
 * Removidas funcionalidades de compartilhamento (Email, WhatsApp, Links públicos)
 * para manter apenas o download direto.
 * 
 * Atualizado: 2025-10-17 - Adicionado salvamento automático no histórico
 * Refatorado em: 2025-10-15
 * Redução: ~242 linhas → ~65 linhas (73%)
 */

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Download, Loader2 } from 'lucide-react';
import { Project, ReportHistoryEntry } from '@/types';
import type { ReportConfig } from './ReportCustomizationModal.types';
import { saveReportToSupabase } from '@/lib/reports-new';
import { storage } from '@/lib/storage';

interface ReportShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  blob: Blob;
  format: 'pdf' | 'xlsx';
  config: ReportConfig;
  project: Project;
  interlocutor: 'cliente' | 'fornecedor';
  installations?: any[]; // Optional for stats calculation
}

export function ReportShareModal({
  isOpen,
  onClose,
  blob,
  format,
  project,
  interlocutor,
  config,
  installations,
}: ReportShareModalProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  // Nome do arquivo
  const fileName = `relatorio-${project.name
    .toLowerCase()
    .replace(/\s+/g, '-')}-${interlocutor}-${new Date().getTime()}.${format}`;

  // Save report to history when modal opens
  useEffect(() => {
    if (isOpen && blob) {
      saveReportToHistory();
    }
  }, [isOpen, blob]);

  const saveReportToHistory = async () => {
    try {
      setIsSaving(true);

      // Prepare report data for stats calculation if installations available
      let reportData = undefined;
      if (installations && installations.length > 0) {
        reportData = {
          project,
          installations,
          versions: [],
          generatedBy: project.owner || 'Sistema',
          generatedAt: new Date().toISOString(),
          interlocutor,
        };
      }

      // Save to Supabase Storage and database
      const supabaseResult = await saveReportToSupabase(
        blob,
        project.id,
        format,
        {
          interlocutor,
          ...config,
        },
        reportData
      );

      // Also save to local IndexedDB for offline access
      const reportEntry: ReportHistoryEntry = {
        id: crypto.randomUUID(),
        projectId: project.id,
        fileName,
        format,
        interlocutor,
        config: {
          interlocutor,
          ...config,
        },
        size: blob.size,
        generatedAt: new Date().toISOString(),
        generatedBy: project.owner || 'Sistema',
        mimeType: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        blob,
        createdAt: Date.now(),
      };

      await storage.saveReport(reportEntry as any);

      if (!supabaseResult) {
        console.warn('[ReportShareModal] Failed to save to Supabase, but saved locally');
      }

    } catch (error) {
      console.error('[ReportShareModal] Error saving report:', error);
      // Don't show error to user as this is background operation
    } finally {
      setIsSaving(false);
    }
  };

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
          {isSaving && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted rounded-md">
              <Loader2 className="h-4 w-4 animate-spin" />
              Salvando relatório no histórico...
            </div>
          )}

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
            disabled={isSaving}
          >
            <Download className="h-5 w-5" />
            Baixar Relatório {format.toUpperCase()}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
