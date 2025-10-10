import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  config,
  project,
  interlocutor,
}: ReportShareModalProps) {
  const { toast } = useToast();
  const [isSharing, setIsSharing] = useState(false);
  const [shareMethod, setShareMethod] = useState<'download' | 'email' | 'whatsapp' | 'copy'>('download');
  const [emailData, setEmailData] = useState({
    to: '',
    subject: `Relatório de Instalações - ${project.name}`,
    message: `Segue anexo o relatório de instalações do projeto ${project.name}.\n\nGerado em: ${new Date().toLocaleString('pt-BR')}`,
  });

  const hasSavedRef = useRef(false);
  const fileName = `Relatorio_${project.name}_${new Date().toISOString().split('T')[0]}_${interlocutor.toUpperCase()}.${format}`;

  const saveReportToHistory = useCallback(async () => {
    if (!blob || !project) return;

    try {
      const generatedAt = new Date().toISOString();
      const reportId = `report_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
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
      };

      await storage.saveReport(reportRecord);
      console.log('✅ Report saved to history successfully');
    } catch (error) {
      console.error('❌ Error saving report to history:', error);
    }
  }, [blob, project, fileName, format, interlocutor, config]);

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
    try {
      // In a real implementation, you would upload the file to a cloud service
      // and get a shareable link. For now, we'll simulate this.
      const mockLink = `https://example.com/reports/${Date.now()}/${fileName}`;
      
      await navigator.clipboard.writeText(mockLink);
      toast({
        title: "Link copiado",
        description: "Link do relatório copiado para a área de transferência",
      });
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o link",
        variant: "destructive",
      });
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
                <Copy className="h-5 w-5" />
                Copiar Link
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground mb-2">
                  ⚠️ Funcionalidade em desenvolvimento
                </div>
                <div className="text-sm">
                  Esta funcionalidade permite gerar um link compartilhável do relatório 
                  que pode ser enviado para qualquer pessoa.
                </div>
              </div>
              <Button onClick={handleCopyLink} variant="outline" className="w-full gap-2">
                <Copy className="h-4 w-4" />
                Copiar Link (Demo)
              </Button>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
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
  );
}