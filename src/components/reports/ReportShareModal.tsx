import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { 
  Download, 
  Share2, 
  Mail, 
  MessageCircle, 
  FileText,
  Table,
} from 'lucide-react';
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
  config,
  project,
  interlocutor,
}: ReportShareModalProps) {
  const { toast } = useToast();
  
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
  }, []);
  const fileName = `relatorio_${interlocutor}_${fileIdentifier}.${format}`;

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

  /**
   * REFATORADO: Versão simplificada usando mailto:
   * - Abre cliente de email padrão do usuário
   * - Pré-preenche assunto e corpo da mensagem
   * - Usuário adiciona destinatário e anexa arquivo manualmente
   * - Funciona 100% offline, sem dependências de backend
   */
  const handleEmail = () => {
    // Dados básicos para o email
    const subject = `Relatório de Instalações - ${project.name}`;
    
    const body = 
      `Olá,\n\n` +
      `Segue relatório de instalações do projeto ${project.name}.\n\n` +
      `Detalhes:\n` +
      `- Projeto: ${project.name}\n` +
      `- Cliente: ${project.client_name || 'Não informado'}\n` +
      `- Gerado em: ${new Date().toLocaleString('pt-BR')}\n` +
      `- Para: ${interlocutor === 'cliente' ? 'Cliente' : 'Fornecedor'}\n` +
      `- Formato: ${format.toUpperCase()}\n\n` +
      `⚠️ IMPORTANTE: O arquivo ${format.toUpperCase()} precisa ser anexado manualmente.\n\n` +
      `Atenciosamente,\n` +
      `Equipe ${project.owner || 'DEA Manager'}`;

    // Encode para URL
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(body);

    // Construir mailto: URL
    const mailtoUrl = `mailto:?subject=${encodedSubject}&body=${encodedBody}`;

    // Abrir cliente de email
    window.location.href = mailtoUrl;

    // Toast de feedback
    toast({
      title: "Cliente de email aberto",
      description: "Complete o email adicionando o destinatário e anexando o arquivo",
    });
  };

  const handleWhatsApp = () => {
    // Construir mensagem simples
    const message = 
      `📊 Relatório de Instalações - ${project.name}\n\n` +
      `Gerado em: ${new Date().toLocaleString('pt-BR')}\n\n` +
      `Para: ${interlocutor === 'cliente' ? 'Cliente' : 'Fornecedor'}\n` +
      `Formato: ${format.toUpperCase()}`;

    // Encode para URL
    const encodedMessage = encodeURIComponent(message);

    // Detectar se é mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // Construir URL do WhatsApp
    const whatsappUrl = isMobile 
      ? `whatsapp://send?text=${encodedMessage}`
      : `https://wa.me/?text=${encodedMessage}`;

    // Abrir WhatsApp
    window.open(whatsappUrl, '_blank');

    // Toast de feedback
    toast({
      title: "WhatsApp aberto",
      description: "Complete o compartilhamento no WhatsApp",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Compartilhar Relatório
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Report Summary */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                {format === 'pdf' ? (
                  <FileText className="h-8 w-8 text-red-500" />
                ) : (
                  <Table className="h-8 w-8 text-green-500" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{fileName}</div>
                  <div className="text-sm text-muted-foreground">
                    {project.name} • {interlocutor === 'cliente' ? 'Cliente' : 'Fornecedor'} • {format.toUpperCase()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Share Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Opções de Compartilhamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Download Button */}
              <Button 
                onClick={handleDownload} 
                className="w-full gap-2 justify-start"
                size="lg"
              >
                <Download className="h-4 w-4" />
                <div className="flex-1 text-left">
                  <div className="font-medium">Download</div>
                  <div className="text-xs opacity-90">Baixar arquivo {format.toUpperCase()} para seu dispositivo</div>
                </div>
              </Button>
              
              {/* Email Button */}
              <Button 
                onClick={handleEmail} 
                variant="outline" 
                className="w-full gap-2 justify-start"
                size="lg"
              >
                <Mail className="h-4 w-4" />
                <div className="flex-1 text-left">
                  <div className="font-medium">Email</div>
                  <div className="text-xs text-muted-foreground">Abrir cliente de email com mensagem pronta</div>
                </div>
              </Button>
              
              {/* WhatsApp Button */}
              <Button 
                onClick={handleWhatsApp} 
                variant="outline" 
                className="w-full gap-2 justify-start"
                size="lg"
              >
                <MessageCircle className="h-4 w-4" />
                <div className="flex-1 text-left">
                  <div className="font-medium">WhatsApp</div>
                  <div className="text-xs text-muted-foreground">Compartilhar via WhatsApp com mensagem pronta</div>
                </div>
              </Button>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="bg-muted/50">
            <CardContent className="pt-4 pb-4">
              <div className="text-sm text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">💡 Dica:</p>
                <p>• <strong>Email e WhatsApp:</strong> Você precisará anexar o arquivo manualmente</p>
                <p>• <strong>Download primeiro:</strong> Recomendamos baixar o arquivo antes de compartilhar</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
