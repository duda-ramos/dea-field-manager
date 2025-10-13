import { useState, useEffect } from "react";
import { 
  AlertCircle, 
  Trash2, 
  Download, 
  RefreshCw, 
  Bug,
  TrendingUp,
  Clock,
  FileJson
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  getErrorLogs,
  clearErrorLogs,
  downloadErrorLogs,
  getErrorStats,
  type ErrorLog,
} from "@/utils/error-logger";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

export default function Debug() {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [stats, setStats] = useState<ReturnType<typeof getErrorStats> | null>(null);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  // Verificar se estamos em desenvolvimento
  const isDevelopment = process.env.NODE_ENV === 'development';

  const loadLogs = () => {
    setLogs(getErrorLogs());
    setStats(getErrorStats());
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleClearLogs = () => {
    if (window.confirm('Tem certeza que deseja limpar todos os logs de erro?')) {
      clearErrorLogs();
      loadLogs();
    }
  };

  const handleDownloadLogs = () => {
    downloadErrorLogs();
  };

  const toggleLogExpansion = (id: string) => {
    setExpandedLog(expandedLog === id ? null : id);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  // Redirect to home if not in development
  if (!isDevelopment) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Acesso Negado</AlertTitle>
          <AlertDescription>
            Esta página está disponível apenas em modo de desenvolvimento.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bug className="h-8 w-8" />
            Debug Console
          </h1>
          <p className="text-muted-foreground mt-1">
            Visualize e gerencie logs de erros do sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={loadLogs}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button
            onClick={handleDownloadLogs}
            variant="outline"
            size="sm"
            disabled={logs.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar JSON
          </Button>
          <Button
            onClick={handleClearLogs}
            variant="destructive"
            size="sm"
            disabled={logs.length === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Limpar Logs
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total de Erros
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                Máximo de 50 erros armazenados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Últimas 24h
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.last24Hours}</div>
              <p className="text-xs text-muted-foreground">
                Erros registrados recentemente
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Tipos de Erro
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Object.keys(stats.byType).length}
              </div>
              <p className="text-xs text-muted-foreground">
                Tipos diferentes de erros
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error Type Breakdown */}
      {stats && Object.keys(stats.byType).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Tipo</CardTitle>
            <CardDescription>
              Contagem de erros por tipo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byType).map(([type, count]) => (
                <Badge key={type} variant="secondary">
                  {type}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Logs List */}
      <Card>
        <CardHeader>
          <CardTitle>Logs de Erros</CardTitle>
          <CardDescription>
            {logs.length === 0
              ? "Nenhum erro registrado"
              : `${logs.length} erro(s) registrado(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileJson className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum erro foi registrado ainda.</p>
              <p className="text-sm mt-2">
                Os erros capturados aparecerão aqui automaticamente.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log, index) => (
                <div key={log.id}>
                  {index > 0 && <Separator className="my-4" />}
                  
                  <div className="space-y-2">
                    {/* Error Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="destructive">
                            {log.error.name}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(log.timestamp)}
                          </span>
                        </div>
                        <p className="font-mono text-sm break-all">
                          {log.error.message}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleLogExpansion(log.id)}
                      >
                        {expandedLog === log.id ? 'Ocultar' : 'Detalhes'}
                      </Button>
                    </div>

                    {/* Expanded Details */}
                    {expandedLog === log.id && (
                      <div className="mt-4 space-y-3 pl-4 border-l-2 border-muted">
                        {/* URL */}
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">
                            URL:
                          </p>
                          <p className="text-xs font-mono break-all">
                            {log.url}
                          </p>
                        </div>

                        {/* Context */}
                        {log.context && Object.keys(log.context).length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1">
                              Contexto:
                            </p>
                            <pre className="text-xs font-mono bg-muted p-2 rounded overflow-auto max-h-40">
                              {JSON.stringify(log.context, null, 2)}
                            </pre>
                          </div>
                        )}

                        {/* Stack Trace */}
                        {log.error.stack && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1">
                              Stack Trace:
                            </p>
                            <pre className="text-xs font-mono bg-muted p-2 rounded overflow-auto max-h-60 whitespace-pre-wrap">
                              {log.error.stack}
                            </pre>
                          </div>
                        )}

                        {/* User Agent */}
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">
                            User Agent:
                          </p>
                          <p className="text-xs font-mono break-all">
                            {log.userAgent}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
