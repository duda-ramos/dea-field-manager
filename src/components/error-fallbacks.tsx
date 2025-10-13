import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Home, RefreshCw, Upload, FileText, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ErrorFallbackProps {
  error?: Error;
}

/**
 * Fallback para erros em páginas de projeto
 * Sugere voltar ao dashboard ou recarregar
 */
export function ProjectErrorFallback({ error }: ErrorFallbackProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <CardTitle>Erro ao carregar projeto</CardTitle>
              <CardDescription>
                Não foi possível carregar as informações do projeto
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Detalhes:</strong> {error.message}
              </p>
            </div>
          )}
          
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => window.location.reload()}
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar Novamente
            </Button>
            
            <Button
              onClick={() => navigate('/dashboard')}
              variant="outline"
              className="w-full"
            >
              <Home className="h-4 w-4 mr-2" />
              Voltar ao Dashboard
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Se o problema persistir, entre em contato com o suporte
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Fallback para erros em upload de arquivos
 * Sugere verificar conexão e tentar novamente
 */
export function UploadErrorFallback({ error }: ErrorFallbackProps) {
  return (
    <div className="min-h-[300px] flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <Upload className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <CardTitle>Erro no upload</CardTitle>
              <CardDescription>
                Não foi possível completar o upload dos arquivos
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Detalhes:</strong> {error.message}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              <strong>Possíveis soluções:</strong>
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Verifique sua conexão com a internet</li>
              <li>Verifique se os arquivos não excedem o tamanho máximo</li>
              <li>Tente fazer upload de menos arquivos por vez</li>
            </ul>
          </div>
          
          <Button
            onClick={() => window.location.reload()}
            className="w-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar Novamente
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Os dados já salvos foram preservados
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Fallback para erros em geração de relatórios
 * Sugere verificar dados e tentar novamente
 */
export function ReportErrorFallback({ error }: ErrorFallbackProps) {
  return (
    <div className="min-h-[300px] flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <FileText className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <CardTitle>Erro ao gerar relatório</CardTitle>
              <CardDescription>
                Não foi possível gerar o relatório solicitado
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Detalhes:</strong> {error.message}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              <strong>Possíveis soluções:</strong>
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Verifique se o projeto possui dados suficientes</li>
              <li>Tente selecionar um período diferente</li>
              <li>Verifique sua conexão com a internet</li>
            </ul>
          </div>
          
          <Button
            onClick={() => window.location.reload()}
            className="w-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar Novamente
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Fallback para erros no dashboard
 * Sugere recarregar ou fazer logout
 */
export function DashboardErrorFallback({ error }: ErrorFallbackProps) {
  return (
    <div className="min-h-[500px] flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <CardTitle>Erro ao carregar dashboard</CardTitle>
              <CardDescription>
                Não foi possível carregar suas informações
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Detalhes:</strong> {error.message}
              </p>
            </div>
          )}
          
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              <strong>Possíveis soluções:</strong>
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Recarregue a página</li>
              <li>Verifique sua conexão com a internet</li>
              <li>Tente fazer logout e login novamente</li>
            </ul>
          </div>
          
          <Button
            onClick={() => window.location.reload()}
            className="w-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Recarregar Página
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Se o problema persistir, entre em contato com o suporte
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Fallback genérico para seções com opção de voltar
 */
export function SectionErrorFallback({ error }: ErrorFallbackProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-[300px] flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <CardTitle>Algo deu errado</CardTitle>
              <CardDescription>
                Não foi possível carregar esta seção
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Detalhes:</strong> {error.message}
              </p>
            </div>
          )}
          
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => window.location.reload()}
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar Novamente
            </Button>
            
            <Button
              onClick={() => navigate(-1)}
              variant="outline"
              className="w-full"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
