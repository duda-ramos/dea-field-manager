import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  AlertTriangle, 
  ArrowLeft, 
  RefreshCw, 
  Home,
  FileImage,
  Upload,
  FileText,
  HelpCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
}

/**
 * Fallback para erros de projeto
 * Sugere voltar ao dashboard
 */
export function ProjectErrorFallback({ error, resetError }: ErrorFallbackProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Erro ao carregar projeto</CardTitle>
          </div>
          <CardDescription>
            Não foi possível carregar as informações do projeto
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error?.message && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">
                <strong>Detalhes:</strong> {error.message}
              </p>
            </div>
          )}
          
          <div className="flex flex-col gap-2">
            {resetError && (
              <Button onClick={resetError} variant="default" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Tentar novamente
              </Button>
            )}
            <Button onClick={() => navigate('/')} variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar ao Dashboard
            </Button>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Se o problema persistir, entre em contato com o suporte
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Fallback para erros de upload
 * Sugere tentar novamente
 */
export function UploadErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div className="min-h-[300px] flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-destructive/10">
              <Upload className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Erro no upload</CardTitle>
          </div>
          <CardDescription>
            Houve um problema ao fazer upload dos arquivos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error?.message && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">
                <strong>Detalhes:</strong> {error.message}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Possíveis causas:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Arquivo muito grande</li>
              <li>Formato de arquivo não suportado</li>
              <li>Problemas de conexão com a internet</li>
              <li>Espaço de armazenamento insuficiente</li>
            </ul>
          </div>
          
          <div className="flex flex-col gap-2">
            {resetError && (
              <Button onClick={resetError} variant="default" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Tentar novamente
              </Button>
            )}
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Verifique sua conexão e tente novamente
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Fallback para erros de relatório
 * Sugere verificar dados
 */
export function ReportErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div className="min-h-[300px] flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-destructive/10">
              <FileText className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Erro ao gerar relatório</CardTitle>
          </div>
          <CardDescription>
            Não foi possível gerar o relatório solicitado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error?.message && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">
                <strong>Detalhes:</strong> {error.message}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Recomendações:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Verifique se o projeto possui dados suficientes</li>
              <li>Confirme se todas as instalações estão preenchidas corretamente</li>
              <li>Tente gerar um relatório mais simples primeiro</li>
            </ul>
          </div>
          
          <div className="flex flex-col gap-2">
            {resetError && (
              <Button onClick={resetError} variant="default" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Tentar novamente
              </Button>
            )}
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Verifique os dados do projeto e tente novamente
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Fallback para erros de galeria
 * Sugere recarregar imagens
 */
export function GalleryErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div className="min-h-[300px] flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-destructive/10">
              <FileImage className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Erro ao carregar galeria</CardTitle>
          </div>
          <CardDescription>
            Não foi possível carregar as imagens da galeria
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error?.message && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">
                <strong>Detalhes:</strong> {error.message}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Possíveis problemas:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Problema ao carregar imagens do servidor</li>
              <li>Imagens corrompidas ou inválidas</li>
              <li>Problemas de conexão</li>
            </ul>
          </div>
          
          <div className="flex flex-col gap-2">
            {resetError && (
              <Button onClick={resetError} variant="default" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Recarregar galeria
              </Button>
            )}
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Verifique sua conexão e tente novamente
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Fallback para erros de operações em lote
 * Sugere verificar seleção
 */
export function BulkOperationErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div className="min-h-[300px] flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Erro em operação em lote</CardTitle>
          </div>
          <CardDescription>
            Não foi possível executar a operação em lote
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error?.message && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">
                <strong>Detalhes:</strong> {error.message}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Sugestões:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Verifique os itens selecionados</li>
              <li>Tente processar menos itens por vez</li>
              <li>Confirme que você tem permissão para esta operação</li>
            </ul>
          </div>
          
          <div className="flex flex-col gap-2">
            {resetError && (
              <Button onClick={resetError} variant="default" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Tentar novamente
              </Button>
            )}
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Reduza a quantidade de itens selecionados e tente novamente
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Fallback genérico para erros de dashboard
 */
export function DashboardErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-destructive/10">
              <Home className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Erro no Dashboard</CardTitle>
          </div>
          <CardDescription>
            Ocorreu um erro ao carregar o dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error?.message && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">
                <strong>Detalhes:</strong> {error.message}
              </p>
            </div>
          )}
          
          <div className="flex flex-col gap-2">
            {resetError && (
              <Button onClick={resetError} variant="default" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Recarregar Dashboard
              </Button>
            )}
            <Button onClick={() => window.location.reload()} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Recarregar Página
            </Button>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
              <HelpCircle className="h-3 w-3" />
              Se o problema persistir, entre em contato com o suporte
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
