import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Download, 
  Share2, 
  Mail, 
  MessageCircle, 
  Copy, 
  Cloud, 
  FileText,
  Table,
  CheckCircle,
  ExternalLink,
  Link,
  Trash2,
  Clock,
  Eye,
  AlertCircle,
  Loader2,
  Calendar,
  Send,
  User
} from 'lucide-react';
import { Project, ReportHistoryEntry } from '@/types';
import { storage } from '@/lib/storage';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { calculateReportSections } from '@/lib/reports-new';
import { ReportConfig } from './ReportCustomizationModal';
import { reportSharingService, PublicReportLink, GeneratePublicLinkOptions } from '@/services/reportSharing';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';

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
  config,
  project,
  interlocutor,
}: ReportShareModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSharing, setIsSharing] = useState(false);
  const [shareMethod, setShareMethod] = useState<'download' | 'email' | 'whatsapp' | 'copy'>('download');
  const [emailData, setEmailData] = useState({
    to: '',
    subject: `Relatório de Instalações - ${project.name}`,
    message: `Segue anexo o relatório de instalações do projeto ${project.name}.\n\nGerado em: ${new Date().toLocaleString('pt-BR')}`,
  });
  
  // Email modal states
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [senderName, setSenderName] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  
  // Estados para links públicos
  const [showLinkConfig, setShowLinkConfig] = useState(false);
  const [linkExpiration, setLinkExpiration] = useState('24h');
  const [customExpiration, setCustomExpiration] = useState('');
  const [limitAccess, setLimitAccess] = useState(false);
  const [maxAccessCount, setMaxAccessCount] = useState(10);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [publicLinks, setPublicLinks] = useState<PublicReportLink[]>([]);
  const [isLoadingLinks, setIsLoadingLinks] = useState(false);
  const [activeTab, setActiveTab] = useState('share');
  const [reportId, setReportId] = useState<string | null>(null);
  const [isSavingReport, setIsSavingReport] = useState(false);
  // Mapa temporário para armazenar tokens recém-gerados (apenas na sessão atual)
  const [linkTokens, setLinkTokens] = useState<Record<string, string>>({});

  const hasSavedRef = useRef(false);

  const generateReportId = useCallback(() => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    // Fallback para ambientes sem crypto.randomUUID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
      const r = Math.random() * 16 | 0;
      const v = char === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }, []);
  
  const fileIdentifier = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const randomPart =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().split('-')[0]
        : Math.random().toString(36).slice(2, 8);

    return `${year}${month}${day}_${hours}${minutes}${seconds}_${randomPart}`;
  }, [interlocutor, format]);
  const fileName = `relatorio_${interlocutor}_${fileIdentifier}.${format}`;

  // Função para carregar links públicos do relatório
  const loadPublicLinks = useCallback(async () => {
    if (!reportId) return;
    
    setIsLoadingLinks(true);
    try {
      const links = await reportSharingService.getPublicLinksByReport(reportId);
      setPublicLinks(links);
    } catch (error) {
      console.error('Erro ao carregar links públicos:', error);
      toast({
        title: "Erro ao carregar links",
        description: "Não foi possível carregar os links públicos",
        variant: "destructive",
      });
    } finally {
      setIsLoadingLinks(false);
    }
  }, [reportId, toast]);

  // Função para calcular a expiração em horas
  const getExpirationHours = useCallback(() => {
    switch (linkExpiration) {
      case '1h': return 1;
      case '24h': return 24;
      case '7d': return 7 * 24;
      case '30d': return 30 * 24;
      case 'custom': {
        if (!customExpiration) return 24; // default
        const selectedDate = new Date(customExpiration);
        const now = new Date();
        const diffMs = selectedDate.getTime() - now.getTime();
        return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)));
      }
      default: return 24;
    }
  }, [linkExpiration, customExpiration]);

  // Função para gerar link público
  const handleGeneratePublicLink = useCallback(async () => {
    if (!reportId) {
      toast({
        title: "Erro",
        description: "Relatório ainda não foi salvo. Tente novamente.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingLink(true);
    try {
      const options: GeneratePublicLinkOptions = {
        expiresIn: getExpirationHours() * 60 * 60 * 1000, // converter horas para ms
        metadata: {
          generatedFrom: 'shareModal',
          interlocutor,
          format,
          projectName: project.name,
        }
      };

      if (limitAccess && maxAccessCount > 0) {
        // Adicionar limite de acesso ao metadata já que não há campo específico
        options.metadata = {
          ...options.metadata,
          maxAccessCount: maxAccessCount,
        };
      }

      const { url, link, token } = await reportSharingService.generatePublicLink(reportId, options);
      
      // Armazenar token temporariamente para permitir cópia posterior
      setLinkTokens(prev => ({ ...prev, [link.id]: token }));
      
      // Copiar URL para clipboard
      await navigator.clipboard.writeText(url);
      
      // Calcular data de expiração para mostrar no toast
      const expirationDate = new Date(link.expires_at);
      const expirationString = expirationDate.toLocaleString('pt-BR');
      
      toast({
        title: "Link copiado!",
        description: `Link copiado para a área de transferência. Válido até ${expirationString}`,
      });

      // Resetar configurações
      setShowLinkConfig(false);
      setLinkExpiration('24h');
      setCustomExpiration('');
      setLimitAccess(false);
      setMaxAccessCount(10);

      // Recarregar lista de links
      await loadPublicLinks();
      
      // Mudar para aba de links ativos
      setActiveTab('links');
    } catch (error) {
      console.error('Erro ao gerar link público:', error);
      toast({
        title: "Erro ao gerar link",
        description: error instanceof Error ? error.message : "Não foi possível gerar o link público",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingLink(false);
    }
  }, [reportId, getExpirationHours, limitAccess, maxAccessCount, interlocutor, format, project.name, loadPublicLinks, toast]);

  // Função para copiar link existente
  const handleCopyExistingLink = useCallback(async (linkId: string) => {
    // Verificar se temos o token armazenado (link recém-criado)
    const token = linkTokens[linkId];
    
    if (token) {
      try {
        const url = reportSharingService.getPublicUrl(token);
        await navigator.clipboard.writeText(url);
        toast({
          title: "Link copiado!",
          description: "Link copiado para a área de transferência",
        });
      } catch (error) {
        toast({
          title: "Erro ao copiar",
          description: "Não foi possível copiar o link",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Token não disponível",
        description: "Por segurança, apenas links recém-gerados podem ser copiados. Gere um novo link se necessário.",
      });
    }
  }, [linkTokens, toast]);

  // Função para revogar link
  const handleRevokeLink = useCallback(async (linkId: string) => {
    if (!confirm("Deseja revogar este link? Esta ação não pode ser desfeita.")) {
      return;
    }

    try {
      await reportSharingService.revokePublicLink(linkId);
      toast({
        title: "Link revogado",
        description: "Link revogado com sucesso",
      });
      await loadPublicLinks();
    } catch (error) {
      toast({
        title: "Erro ao revogar",
        description: "Não foi possível revogar o link",
        variant: "destructive",
      });
    }
  }, [loadPublicLinks, toast]);

  // Função para formatar data relativa
  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMs < 0) return 'Expirado';
    if (diffDays > 0) return `Expira em ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
    if (diffHours > 0) return `Expira em ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    if (diffMinutes > 0) return `Expira em ${diffMinutes} minuto${diffMinutes > 1 ? 's' : ''}`;
    return 'Expira em breve';
  };

  const saveReportToHistory = useCallback(async () => {
    console.log('[DEBUG] ═══ INICIANDO saveReportToHistory ═══');
    console.log('[DEBUG] user:', user?.id);
    console.log('[DEBUG] project:', project?.id);
    console.log('[DEBUG] blob:', blob?.size, 'bytes');
    
    // SEMPRE gerar ID primeiro (antes de qualquer operação)
    const newReportId = generateReportId();
    console.log('[DEBUG] Report ID gerado:', newReportId);
    
    // DEFINIR reportId IMEDIATAMENTE
    setReportId(newReportId);
    console.log('[DEBUG] ✅ reportId definido imediatamente');
    
    if (!blob || !project || !user?.id) {
      console.log('[DEBUG] ⚠️ Dados incompletos - modo local apenas');
      setIsSavingReport(false);
      return;
    }
    
    setIsSavingReport(true);

    const generatedAt = new Date().toISOString();
    const storagePath = `${user.id}/${project.id}/${fileName}`;
    
    // ═══ ETAPA 1: SALVAR LOCALMENTE (SEMPRE) ═══
    try {
      console.log('[DEBUG] Salvando localmente...');
      const reportRecord: ReportHistoryEntry = {
        id: newReportId,
        projectId: project.id,
        project_id: project.id,
        payloadId: newReportId,
        fileName,
        format,
        interlocutor,
        config,
        blob,
        size: blob.size,
        mimeType: blob.type || (format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
        generatedAt,
        generated_at: generatedAt,
        generatedBy: project.owner || 'Sistema',
        generated_by: project.owner || 'Sistema',
        createdAt: Date.now(),
        storagePath,
        storage_path: storagePath,
      };

      await storage.saveReport(reportRecord);
      console.log('[DEBUG] ✅ Salvo localmente com sucesso');
    } catch (error) {
      console.error('[DEBUG] ❌ Erro ao salvar localmente:', error);
      // Continuar mesmo se local storage falhar
    }

    // ═══ ETAPA 2: TENTAR UPLOAD PARA SUPABASE ═══
    let uploadSuccess = false;
    let uploadedFilePath = '';
    
    try {
      console.log('[DEBUG] Tentando upload para Supabase...');
      console.log('[DEBUG] Storage path:', storagePath);

      // Fazer upload com timeout de 60 segundos
      const uploadPromise = supabase.storage
        .from('reports')
        .upload(storagePath, blob, {
          contentType: blob.type || (format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
          upsert: true
        });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Upload timeout após 60s')), 60000)
      );

      const { error: uploadError } = await Promise.race([uploadPromise, timeoutPromise]) as any;

      if (uploadError) {
        console.error('[DEBUG] ❌ Erro no upload:', uploadError.message);
        throw uploadError;
      }

      uploadedFilePath = storagePath;
      uploadSuccess = true;
      console.log('[DEBUG] ✅ Upload concluído:', uploadedFilePath);

    } catch (error: any) {
      console.error('[DEBUG] ❌ Upload falhou:', error.message);
      uploadSuccess = false;

      // Mostrar toast informativo
      toast({
        title: 'Modo offline',
        description: 'Relatório salvo localmente. Compartilhamento online não disponível.',
        variant: 'default',
      });
    }

    // ═══ ETAPA 3: SALVAR METADADOS NO BANCO (SE UPLOAD DEU CERTO) ═══
    if (uploadSuccess && uploadedFilePath) {
      try {
        console.log('[DEBUG] Salvando metadados no banco...');
        
        // Calcular estatísticas
        let stats = {};
        try {
          const installations = await storage.getInstallationsByProject(project.id);
          const versions = await Promise.all(
            installations.map(installation => storage.getItemVersions(installation.id))
          ).then(results => results.flat());

          const reportData = {
            project,
            installations,
            versions,
            generatedBy: project.owner || 'Sistema',
            generatedAt,
            interlocutor,
          };

          const sections = calculateReportSections(reportData as any);
          
          stats = {
            pendencias: sections.pendencias.length,
            concluidas: sections.concluidas.length,
            emRevisao: sections.emRevisao.length,
            emAndamento: sections.emAndamento.length,
            total: installations.length,
          };
          
          console.log('[DEBUG] Estatísticas calculadas:', stats);
        } catch (error) {
          console.error('[DEBUG] ⚠️ Erro ao calcular stats:', error);
          // Continuar com stats vazio
        }

        const insertData = {
          id: newReportId,
          project_id: project.id,
          interlocutor,
          format,
          generated_by: user.id,
          generated_at: generatedAt,
          file_url: uploadedFilePath,
          file_name: fileName,
          sections_included: config.sections || {},
          stats,
          user_id: user.id,
        };
        
        console.log('[DEBUG] Dados para insert:', insertData);
        
        const { data, error } = await supabase
          .from('project_report_history')
          .insert(insertData)
          .select('id')
          .single();

        if (error) {
          console.error('[DEBUG] ❌ Erro ao salvar no banco:', error);
          console.error('[DEBUG] Error details:', error.details, error.message, error.hint);
        } else if (data) {
          console.log('[DEBUG] ✅ Salvo no banco com sucesso:', data.id);
        }
      } catch (error) {
        console.error('[DEBUG] ❌ Erro no processo de banco:', error);
      }
    }

    setIsSavingReport(false);
    console.log('[DEBUG] ═══ PROCESSO CONCLUÍDO ═══');
    console.log('[DEBUG] reportId final:', newReportId);
    
  }, [blob, project, user, fileName, format, interlocutor, config, toast, generateReportId]);

  useEffect(() => {
    if (isOpen && blob && project && !hasSavedRef.current) {
      hasSavedRef.current = true;
      void saveReportToHistory();
    }

    if (!isOpen) {
      hasSavedRef.current = false;
      // Resetar estados quando fechar o modal
      setActiveTab('share');
      setShowLinkConfig(false);
      setLinkExpiration('24h');
      setCustomExpiration('');
      setLimitAccess(false);
      setMaxAccessCount(10);
      setReportId(null);
      setIsSavingReport(false);
      setLinkTokens({});
      setPublicLinks([]);
      // Resetar estados de email
      setEmailModalOpen(false);
      setRecipientEmail('');
      setSenderName('');
    }
  }, [isOpen, blob, project, saveReportToHistory]);

  // Carregar links públicos quando o reportId estiver disponível
  useEffect(() => {
    if (reportId && isOpen) {
      void loadPublicLinks();
    }
  }, [reportId, isOpen, loadPublicLinks]);

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

  const handleWhatsApp = () => {
    // Convert blob to base64 for WhatsApp sharing (simplified)
    const message = encodeURIComponent(
      `🏗️ *Relatório de Instalações*\n\n` +
      `📋 Projeto: ${project.name}\n` +
      `👤 Para: ${interlocutor}\n` +
      `📅 Gerado em: ${new Date().toLocaleString('pt-BR')}\n\n` +
      `📊 Resumo:\n` +
      `${config.sections.pendencias ? '🔴 Pendências\n' : ''}` +
      `${config.sections.concluidas ? '✅ Concluídas\n' : ''}` +
      `${config.sections.emRevisao ? '🔍 Em Revisão\n' : ''}` +
      `${config.sections.emAndamento ? '⏳ Em Andamento\n' : ''}\n` +
      `*Arquivo será enviado separadamente*`
    );

    const whatsappUrl = `https://wa.me/?text=${message}`;
    window.open(whatsappUrl, '_blank');

    toast({
      title: "WhatsApp aberto",
      description: "Complete o envio compartilhando o arquivo manualmente",
    });
  };

  const handleEmail = async () => {
    // Open email modal instead of using mailto
    setEmailModalOpen(true);
  };
  
  const handleSendEmail = async () => {
    if (!recipientEmail || !reportId) {
      toast({
        title: "Dados incompletos",
        description: "Por favor, preencha o email do destinatário",
        variant: "destructive",
      });
      return;
    }

    setSendingEmail(true);
    
    try {
      // Check if report exists in Supabase
      const { data: reportExists } = await supabase
        .from('project_report_history')
        .select('id')
        .eq('id', reportId)
        .single();

      if (!reportExists) {
        // Report not in Supabase - try to save it first
        console.log('[DEBUG] Report not found in Supabase, attempting to save...');
        
        try {
          // Generate a temporary file URL for the blob
          const tempBlobUrl = URL.createObjectURL(blob);
          
          // Try to save to Supabase one more time
          const storagePath = `${user?.id}/${project.id}/${fileName}`;
          const { error: uploadError } = await supabase.storage
            .from('reports')
            .upload(storagePath, blob, {
              contentType: blob.type || (format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
              upsert: true // Allow upsert this time
            });

          if (!uploadError) {
            // Try to save to database
            await supabase
              .from('project_report_history')
              .insert({
                id: reportId,
                project_id: project.id,
                interlocutor,
                format,
                generated_by: user?.id,
                generated_at: new Date().toISOString(),
                file_url: storagePath,
                file_name: fileName,
                sections_included: config.sections || {},
                stats: {},
                user_id: user?.id,
              });
          }
          
          URL.revokeObjectURL(tempBlobUrl);
        } catch (error) {
          console.error('[DEBUG] Failed to save report to Supabase:', error);
        }
      }

      // Try to generate public link and send email
      try {
        const { url, token } = await reportSharingService.generatePublicLink(reportId, {
          expiresIn: 30 * 24 * 60 * 60 * 1000, // 30 days
        });

        // Send email with the public link
        const result = await reportSharingService.sendReportByEmail({
          to: recipientEmail,
          reportId,
          publicToken: token,
          projectName: project.name,
          projectId: project.id,
          senderName: senderName || undefined,
        });

        if (result.success) {
          toast({
            title: "Email enviado com sucesso",
            description: `Relatório enviado para ${recipientEmail}`,
          });
          setEmailModalOpen(false);
          setRecipientEmail('');
          setSenderName('');
          // Recarregar links após enviar email (que cria um novo link)
          await loadPublicLinks();
        } else {
          throw new Error(result.error || "Erro ao enviar email");
        }
      } catch (error: any) {
        // Fallback: Send email with download instructions instead of link
        console.log('[DEBUG] Fallback: Sending email without public link');
        
        toast({
          title: "Modo de envio alternativo",
          description: "O link público não pôde ser gerado. Use o botão de download para salvar o arquivo e envie manualmente.",
          variant: "default",
        });
        
        // Open mailto with basic instructions
        const subject = encodeURIComponent(`Relatório de Instalações - ${project.name}`);
        const body = encodeURIComponent(
          `Olá,\n\n` +
          `Segue o relatório de instalações do projeto ${project.name}.\n\n` +
          `Detalhes:\n` +
          `- Projeto: ${project.name}\n` +
          `- Tipo: ${interlocutor}\n` +
          `- Formato: ${format.toUpperCase()}\n` +
          `- Gerado em: ${new Date().toLocaleString('pt-BR')}\n\n` +
          `Por favor, solicite o arquivo em anexo.\n\n` +
          `Atenciosamente,\n${senderName || 'Sistema de Relatórios'}`
        );
        
        window.location.href = `mailto:${recipientEmail}?subject=${subject}&body=${body}`;
        setEmailModalOpen(false);
      }
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast({
        title: "Erro ao enviar email",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const getShareMethodContent = () => {
    switch (shareMethod) {
      case 'download':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Download Direto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  {format === 'pdf' ? (
                    <FileText className="h-8 w-8 text-red-500" />
                  ) : (
                    <Table className="h-8 w-8 text-green-500" />
                  )}
                  <div>
                    <div className="font-medium">{fileName}</div>
                    <div className="text-sm text-muted-foreground">
                      {format.toUpperCase()} • {(blob.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                </div>
                <Button onClick={handleDownload} className="gap-2">
                  <Download className="h-4 w-4" />
                  Baixar
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 'email':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Enviar por Email
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground mb-2">
                  📧 Envio profissional por email
                </div>
                <div className="text-sm space-y-2">
                  <div>• Email HTML responsivo e profissional</div>
                  <div>• Link seguro para visualização online</div>
                  <div>• Expiração automática em 30 dias</div>
                  <div>• Sem anexos pesados</div>
                </div>
              </div>
              {isSavingReport ? (
                <div className="flex items-center gap-2 text-yellow-600 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparando relatório...
                </div>
              ) : reportId ? (
                <Button
                  onClick={handleEmail}
                  disabled={sendingEmail}
                  className="w-full gap-2"
                >
                  {sendingEmail ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      Configurar Envio por Email
                    </>
                  )}
                </Button>
              ) : (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  Erro ao preparar relatório
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'whatsapp':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Compartilhar via WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground mb-2">Prévia da mensagem:</div>
                <div className="text-sm">
                  🏗️ <strong>Relatório de Instalações</strong><br/>
                  📋 Projeto: {project.name}<br/>
                  👤 Para: {interlocutor}<br/>
                  📅 Gerado em: {new Date().toLocaleString('pt-BR')}
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                💡 O WhatsApp será aberto com a mensagem pronta. 
                Você precisará anexar o arquivo manualmente após enviar a mensagem.
              </div>
              <Button onClick={handleWhatsApp} className="w-full gap-2">
                <MessageCircle className="h-4 w-4" />
                Abrir WhatsApp
              </Button>
            </CardContent>
          </Card>
        );

      case 'copy':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link className="h-5 w-5" />
                Gerar Link Público
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!showLinkConfig ? (
                <>
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground mb-2">
                      <AlertCircle className="h-4 w-4 inline mr-1" />
                      Link público
                    </div>
                    <div className="text-sm">
                      Gere um link público para compartilhar este relatório com qualquer pessoa,
                      mesmo sem acesso ao sistema.
                    </div>
                  </div>
                  <Button 
                    onClick={() => setShowLinkConfig(true)} 
                    className="w-full gap-2"
                    disabled={!reportId}
                    >
                      <Link className="h-4 w-4" />
                      Configurar Link Público
                    </Button>
                  {!reportId && (
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                      ⚠️ Links públicos requerem salvamento na nuvem
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Configuração de expiração */}
                  <div className="space-y-2">
                    <Label>Tempo de expiração</Label>
                    <Select value={linkExpiration} onValueChange={setLinkExpiration}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1h">1 hora</SelectItem>
                        <SelectItem value="24h">24 horas (padrão)</SelectItem>
                        <SelectItem value="7d">7 dias</SelectItem>
                        <SelectItem value="30d">30 dias</SelectItem>
                        <SelectItem value="custom">Personalizado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Data personalizada */}
                  {linkExpiration === 'custom' && (
                    <div className="space-y-2">
                      <Label>Data de expiração</Label>
                      <Input
                        type="datetime-local"
                        value={customExpiration}
                        onChange={(e) => setCustomExpiration(e.target.value)}
                        min={new Date().toISOString().slice(0, 16)}
                      />
                    </div>
                  )}

                  {/* Limite de acessos */}
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="limit-access"
                      checked={limitAccess}
                      onCheckedChange={(checked) => setLimitAccess(checked as boolean)}
                    />
                    <div className="space-y-1 flex-1">
                      <Label htmlFor="limit-access" className="cursor-pointer">
                        Limitar número de acessos
                      </Label>
                      {limitAccess && (
                        <Input
                          type="number"
                          value={maxAccessCount}
                          onChange={(e) => setMaxAccessCount(Math.max(1, parseInt(e.target.value) || 1))}
                          min="1"
                          placeholder="Número máximo de acessos"
                        />
                      )}
                    </div>
                  </div>

                  {/* Botões de ação */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowLinkConfig(false)}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleGeneratePublicLink}
                      disabled={isGeneratingLink || (linkExpiration === 'custom' && !customExpiration)}
                      className="flex-1 gap-2"
                    >
                      {isGeneratingLink ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Gerando...
                        </>
                      ) : (
                        <>
                          <Link className="h-4 w-4" />
                          Gerar Link
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  // Função para renderizar card de link público
  const renderPublicLinkCard = (link: PublicReportLink) => {
    const isExpired = new Date(link.expires_at) < new Date();
    const hasMaxAccess = link.metadata?.maxAccessCount;
    const isNewLink = !!linkTokens[link.id];
    
    return (
      <Card key={link.id} className={`${isExpired ? 'opacity-60' : ''} ${isNewLink ? 'ring-2 ring-primary' : ''}`}>
        <CardContent className="pt-4">
          <div className="space-y-3">
            {/* Token e status */}
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="font-mono text-sm">
                  {link.token_hash.substring(0, 8)}...
                </div>
                <div className="text-xs text-muted-foreground">
                  Criado em {new Date(link.created_at).toLocaleString('pt-BR')}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isNewLink && (
                  <Badge variant="secondary" className="text-xs">
                    Novo
                  </Badge>
                )}
                <Badge variant={isExpired ? 'destructive' : 'default'}>
                  {isExpired ? 'Expirado' : 'Ativo'}
                </Badge>
              </div>
            </div>

            {/* Informações do link */}
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className={isExpired ? 'text-destructive' : ''}>
                  {formatRelativeDate(link.expires_at)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="h-3 w-3 text-muted-foreground" />
                <span>
                  {link.access_count} visualiza{link.access_count === 1 ? 'ção' : 'ções'}
                  {hasMaxAccess && ` / ${link.metadata.maxAccessCount}`}
                </span>
              </div>
            </div>

            {/* Ações */}
            <div className="flex gap-2">
              {linkTokens[link.id] && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopyExistingLink(link.id)}
                  className="flex-1 gap-1"
                >
                  <Copy className="h-3 w-3" />
                  Copiar
                </Button>
              )}
              {link.is_active && !isExpired && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRevokeLink(link.id)}
                  className={`${linkTokens[link.id] ? "flex-1" : "w-full"} gap-1 text-destructive hover:text-destructive`}
                >
                  <Trash2 className="h-3 w-3" />
                  Revogar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-[95vw] w-full max-h-[95vh] sm:max-w-3xl overflow-hidden">
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Share2 className="h-5 w-5" />
              Compartilhar Relatório
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="share">Compartilhar</TabsTrigger>
              <TabsTrigger value="links" className="relative">
                Links Ativos
                {publicLinks.filter(l => l.is_active && new Date(l.expires_at) > new Date()).length > 0 && (
                  <Badge 
                    variant="secondary" 
                    className="ml-2 h-5 px-1 text-xs"
                  >
                    {publicLinks.filter(l => l.is_active && new Date(l.expires_at) > new Date()).length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="share" className="space-y-4 mt-4">
              {/* Report Summary */}
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {format === 'pdf' ? (
                        <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-red-500 shrink-0" />
                      ) : (
                        <Table className="h-6 w-6 sm:h-8 sm:w-8 text-green-500 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium text-sm sm:text-base truncate">{fileName}</div>
                        <div className="text-xs sm:text-sm text-muted-foreground">
                          Projeto: {project.name} • {interlocutor}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {format.toUpperCase()}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Share Method Selection */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { key: 'download', icon: Download, label: 'Baixar' },
                  { key: 'email', icon: Mail, label: 'Email' },
                  { key: 'whatsapp', icon: MessageCircle, label: 'WhatsApp' },
                  { key: 'copy', icon: Link, label: 'Link' },
                ].map(method => (
                  <Button
                    key={method.key}
                    variant={shareMethod === method.key ? 'default' : 'outline'}
                    onClick={() => setShareMethod(method.key as any)}
                    className="flex flex-col gap-1 h-auto py-2 text-xs"
                  >
                    <method.icon className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="text-xs">{method.label}</span>
                  </Button>
                ))}
              </div>

              {/* Share Method Content */}
              <div className="min-h-[180px] sm:min-h-[200px]">
                {getShareMethodContent()}
              </div>
            </TabsContent>

            <TabsContent value="links" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Links Públicos Gerados</h3>
                  <Button
                    size="sm"
                    onClick={() => {
                      setActiveTab('share');
                      setShareMethod('copy');
                    }}
                    className="gap-1"
                  >
                    <Link className="h-3 w-3" />
                    Novo Link
                  </Button>
                </div>

                {isLoadingLinks ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <Card key={i}>
                        <CardContent className="pt-4">
                          <div className="space-y-3">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-48" />
                            <div className="flex gap-2">
                              <Skeleton className="h-8 flex-1" />
                              <Skeleton className="h-8 flex-1" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : publicLinks.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 pb-6 text-center">
                      <Link className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">
                        Nenhum link público gerado ainda
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setActiveTab('share');
                          setShareMethod('copy');
                        }}
                        className="mt-3 gap-1"
                      >
                        <Link className="h-3 w-3" />
                        Gerar Primeiro Link
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                    {publicLinks.map(renderPublicLinkCard)}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Configuration Modal */}
      <AlertDialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Enviar Relatório por Email
            </AlertDialogTitle>
            <AlertDialogDescription>
              Configure o envio do relatório por email. O destinatário receberá um link seguro para visualização.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="recipient-email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email do destinatário <span className="text-red-500">*</span>
              </Label>
              <Input
                id="recipient-email"
                type="email"
                placeholder="exemplo@email.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                disabled={sendingEmail}
                className="w-full"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="sender-name" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Seu nome (opcional)
              </Label>
              <Input
                id="sender-name"
                type="text"
                placeholder="João Silva"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                disabled={sendingEmail}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Se informado, será usado na saudação do email
              </p>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              <div className="font-medium text-blue-900 mb-1">ℹ️ O que será enviado:</div>
              <ul className="text-blue-800 space-y-1 text-xs">
                <li>• Email HTML profissional com as estatísticas do relatório</li>
                <li>• Link seguro para visualização online (válido por 30 dias)</li>
                <li>• Informações do projeto e progresso</li>
              </ul>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={sendingEmail}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSendEmail}
              disabled={!recipientEmail || sendingEmail}
              className="gap-2"
            >
              {sendingEmail ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Enviar Email
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}