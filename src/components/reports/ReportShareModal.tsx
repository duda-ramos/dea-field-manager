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
  Calendar
} from 'lucide-react';
import { Project, ReportHistoryEntry } from '@/types';
import { storage } from '@/lib/storage';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { calculateReportSections } from '@/lib/reports-new';
import { ReportConfig } from './ReportCustomizationModal';
import { reportSharingService, PublicReportLink, GeneratePublicLinkOptions } from '@/services/reportSharing';
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
    if (!blob || !project || !user) {
      console.log('⚠️ Missing required data for saving report:', {
        hasBlob: !!blob,
        hasProject: !!project,
        hasUser: !!user
      });
      return;
    }

    const generatedAt = new Date().toISOString();
    const newReportId = generateReportId();
    const storagePath = `${user.id}/${project.id}/${fileName}`;

    // Save to local storage first (for backward compatibility)
    try {
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
    let persistedReportId: string | null = null;

    if (uploadedFilePath) {
      try {
        const { data, error } = await supabase
          .from('project_report_history')
          .insert({
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
          })
          .select('id')
          .single();

        if (error) {
          console.error('❌ Error saving report to Supabase database:', error);
          throw error;
        }

        persistedReportId = data?.id || newReportId;
        console.log('✅ Report saved to Supabase database successfully');
      } catch (error) {
        console.error('❌ Error saving report to database:', error);
        toast({
          title: 'Erro ao salvar na nuvem',
          description: 'Não foi possível salvar o relatório para gerar links públicos.',
          variant: 'destructive',
        });
      }
    }

    if (persistedReportId) {
      setReportId(persistedReportId);
    } else {
      setReportId(null);
    }
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
      setLinkTokens({});
      setPublicLinks([]);
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
    setIsSharing(true);
    
    try {
      // In a real implementation, you would call an API to send the email
      // with the attachment. For now, we'll simulate this.
      
      const mailtoLink = `mailto:${emailData.to}?subject=${encodeURIComponent(emailData.subject)}&body=${encodeURIComponent(emailData.message)}`;
      window.location.href = mailtoLink;
      
      toast({
        title: "Cliente de email aberto",
        description: "Complete o envio anexando o arquivo manualmente",
      });
    } catch (error) {
      toast({
        title: "Erro no envio",
        description: "Não foi possível abrir o cliente de email",
        variant: "destructive",
      });
    } finally {
      setIsSharing(false);
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
              <div>
                <Label htmlFor="email-to">Para:</Label>
                <Input
                  id="email-to"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={emailData.to}
                  onChange={(e) => setEmailData(prev => ({ ...prev, to: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="email-subject">Assunto:</Label>
                <Input
                  id="email-subject"
                  value={emailData.subject}
                  onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="email-message">Mensagem:</Label>
                <Textarea
                  id="email-message"
                  rows={4}
                  value={emailData.message}
                  onChange={(e) => setEmailData(prev => ({ ...prev, message: e.target.value }))}
                />
              </div>
              <Button 
                onClick={handleEmail} 
                disabled={isSharing || !emailData.to}
                className="w-full gap-2"
              >
                <Mail className="h-4 w-4" />
                {isSharing ? 'Enviando...' : 'Abrir Cliente de Email'}
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
  );
}