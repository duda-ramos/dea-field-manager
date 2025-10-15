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
  ExternalLink
} from 'lucide-react';
import { Project, ReportHistoryEntry } from '@/types';
import { storage } from '@/lib/storage';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { calculateReportSections } from '@/lib/reports-new';
import { ReportConfig } from './ReportCustomizationModal';
import { reportSharingService } from '@/services/reportSharing';
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
import { Loader2, Send, User } from 'lucide-react';

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
  const [publicLinkData, setPublicLinkData] = useState<{ token: string; url: string } | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);

  const hasSavedRef = useRef(false);
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

  const saveReportToHistory = useCallback(async () => {
    if (!blob || !project || !user) {
      console.log('⚠️ Missing required data for saving report:', { 
        hasBlob: !!blob, 
        hasProject: !!project, 
        hasUser: !!user 
      });
      return;
    }

    const generatedAt = new Date().toISOString();
    const reportId = `report_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const storagePath = `${user.id}/${project.id}/${fileName}`;

    // Save to local storage first (for backward compatibility)
    try {
      const reportRecord: ReportHistoryEntry = {
        id: reportId,
        projectId: project.id,
        project_id: project.id,
        payloadId: reportId,
        fileName,
        format,
        interlocutor,
        config,
        blob,
        size: blob.size,
        mimeType:
          blob.type ||
          (format === 'pdf'
            ? 'application/pdf'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
        generatedAt,
        generated_at: generatedAt,
        generatedBy: project.owner || 'Sistema',
        generated_by: project.owner || 'Sistema',
        createdAt: Date.now(),
        storagePath,
        storage_path: storagePath,
      };

      await storage.saveReport(reportRecord);
      console.log('✅ Report saved to local storage successfully');
    } catch (error) {
      console.error('❌ Error saving report to local storage:', error);
      // Continue to Supabase upload even if local storage fails
    }

    // Upload to Supabase Storage
    let uploadedFilePath = '';
    try {
      const { error: uploadError } = await supabase.storage
        .from('reports')
        .upload(storagePath, blob, {
          contentType: blob.type || (format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
          upsert: false
        });

      if (uploadError) {
        console.error('❌ Error uploading to Supabase Storage:', uploadError);
        throw uploadError;
      }

      uploadedFilePath = storagePath;
      console.log('✅ Report uploaded to Supabase Storage:', uploadedFilePath);
    } catch (error) {
      console.error('❌ Error uploading report to Supabase Storage:', error);
      // Don't block the process if storage upload fails
    }

    // Calculate statistics for the report
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
      
      console.log('✅ Report statistics calculated:', stats);
    } catch (error) {
      console.error('❌ Error calculating report statistics:', error);
      // Continue with empty stats if calculation fails
    }

    // Save to Supabase database
    if (uploadedFilePath) {
      try {
        const { data, error } = await supabase
          .from('project_report_history')
          .insert({
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
          })
          .select()
          .single();

        if (error) {
          console.error('❌ Error saving report to Supabase database:', error);
          // Don't throw, just log the error
        } else if (data) {
          console.log('✅ Report saved to Supabase database successfully');
          setReportId(data.id);
        }
      } catch (error) {
        console.error('❌ Error saving report to database:', error);
        // Don't show error toast as local storage already has the report
      }
    }
  }, [blob, project, user, fileName, format, interlocutor, config]);

  useEffect(() => {
    if (isOpen && blob && project && !hasSavedRef.current) {
      hasSavedRef.current = true;
      void saveReportToHistory();
    }

    if (!isOpen) {
      hasSavedRef.current = false;
    }
  }, [isOpen, blob, project, saveReportToHistory]);

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

  const handleCopyLink = async () => {
    if (!reportId) {
      toast({
        title: "Aguarde",
        description: "O relatório ainda está sendo processado",
        variant: "destructive",
      });
      return;
    }

    setIsSharing(true);
    
    try {
      // Generate public link if not already generated
      let linkData = publicLinkData;
      if (!linkData) {
        const { url, token } = await reportSharingService.generatePublicLink(reportId, {
          expiresIn: 30 * 24 * 60 * 60 * 1000, // 30 days
        });
        linkData = { token, url };
        setPublicLinkData(linkData);
      }
      
      await navigator.clipboard.writeText(linkData.url);
      toast({
        title: "Link copiado",
        description: "Link do relatório copiado para a área de transferência",
      });
    } catch (error: any) {
      console.error('Error copying link:', error);
      toast({
        title: "Erro ao copiar",
        description: error.message || "Não foi possível copiar o link",
        variant: "destructive",
      });
    } finally {
      setIsSharing(false);
    }
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
      // First, generate public link if not already generated
      let linkData = publicLinkData;
      if (!linkData) {
        const { url, token } = await reportSharingService.generatePublicLink(reportId, {
          expiresIn: 30 * 24 * 60 * 60 * 1000, // 30 days
        });
        linkData = { token, url };
        setPublicLinkData(linkData);
      }

      // Send email with the public link
      const result = await reportSharingService.sendReportByEmail({
        to: recipientEmail,
        reportId,
        publicToken: linkData.token,
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
      } else {
        toast({
          title: "Erro ao enviar email",
          description: result.error || "Tente novamente mais tarde",
          variant: "destructive",
        });
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
              {!reportId && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  ⚠️ Aguardando salvamento do relatório...
                </div>
              )}
              <Button 
                onClick={handleEmail} 
                disabled={!reportId}
                className="w-full gap-2"
              >
                <Mail className="h-4 w-4" />
                Configurar Envio por Email
              </Button>
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
                <Copy className="h-5 w-5" />
                Link Público
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground mb-2">
                  🔗 Compartilhamento por link
                </div>
                <div className="text-sm space-y-2">
                  <div>• Link seguro para visualização online</div>
                  <div>• Válido por 30 dias</div>
                  <div>• Pode ser compartilhado com qualquer pessoa</div>
                  <div>• Sem necessidade de login</div>
                </div>
              </div>
              {publicLinkData && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800 text-sm">
                    <CheckCircle className="h-4 w-4" />
                    Link gerado com sucesso!
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Input 
                      value={publicLinkData.url} 
                      readOnly 
                      className="text-xs font-mono"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(publicLinkData.url, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
              {!reportId && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  ⚠️ Aguardando salvamento do relatório...
                </div>
              )}
              <Button 
                onClick={handleCopyLink} 
                disabled={isSharing || !reportId}
                className="w-full gap-2"
              >
                {isSharing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gerando link...
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    {publicLinkData ? 'Copiar Link Novamente' : 'Gerar e Copiar Link'}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-[95vw] w-full max-h-[95vh] sm:max-w-2xl overflow-hidden">
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Share2 className="h-5 w-5" />
              Compartilhar Relatório
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
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
                { key: 'copy', icon: Copy, label: 'Link' },
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
          </div>

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