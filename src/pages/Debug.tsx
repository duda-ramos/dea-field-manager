import { useState, useEffect } from "react";
import { 
  AlertCircle, 
  Trash2, 
  Download, 
  RefreshCw, 
  Bug,
  TrendingUp,
  Clock,
  FileJson,
  Undo2,
  History,
  PlayCircle,
  CheckCircle2,
  XCircle
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
import { ErrorBoundaryTest } from "@/components/ErrorBoundaryTest";
import { LoadingBoundary } from "@/components/loading-boundary";
import { useUndo } from "@/hooks/useUndo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { showUndoToast } from "@/lib/toast";
import type { Project, Installation } from "@/types";

export default function Debug() {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [stats, setStats] = useState<ReturnType<typeof getErrorStats> | null>(null);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  
  // Undo system
  const { addAction, undo, canUndo, clearHistory, history } = useUndo();
  const [testResults, setTestResults] = useState<Record<string, 'success' | 'error' | 'pending'>>({});

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

  // Undo Test Functions
  const testCreateProject = async () => {
    const testId = 'test-create-project';
    setTestResults(prev => ({ ...prev, [testId]: 'pending' }));
    
    try {
      const testProject: Partial<Project> = {
        name: `Projeto Teste ${Date.now()}`,
        client: 'Cliente Teste',
        city: 'São Paulo',
        code: `TEST-${Date.now()}`,
        status: 'planning' as const,
        owner: 'Teste',
        suppliers: ['Fornecedor Teste'],
      };

      const { data, error } = await supabase
        .from('projects')
        .insert([testProject as any])
        .select()
        .single();

      if (error) throw error;

      // Adiciona ação de undo
      addAction({
        type: 'CREATE_PROJECT',
        description: `Criou projeto ${data.name}`,
        data: { projectId: data.id },
        undo: async () => {
          await supabase.from('projects').delete().eq('id', data.id);
          toast.success('Projeto de teste removido');
        },
      });

      showUndoToast(`Projeto criado: ${data.name}`, async () => {
        await undo();
      });

      setTestResults(prev => ({ ...prev, [testId]: 'success' }));
    } catch (error) {
      console.error('Erro no teste de criar projeto:', error);
      toast.error('Erro ao criar projeto de teste');
      setTestResults(prev => ({ ...prev, [testId]: 'error' }));
    }
  };

  const testEditProject = async () => {
    const testId = 'test-edit-project';
    setTestResults(prev => ({ ...prev, [testId]: 'pending' }));
    
    try {
      // Busca primeiro projeto disponível
      const { data: projects } = await supabase
        .from('projects')
        .select('*')
        .limit(1);

      if (!projects || projects.length === 0) {
        toast.error('Nenhum projeto encontrado para editar');
        setTestResults(prev => ({ ...prev, [testId]: 'error' }));
        return;
      }

      const project = projects[0];
      const oldName = project.name;
      const newName = `${oldName} (Editado ${Date.now()})`;

      const { error } = await supabase
        .from('projects')
        .update({ name: newName })
        .eq('id', project.id);

      if (error) throw error;

      // Adiciona ação de undo
      addAction({
        type: 'UPDATE_PROJECT',
        description: `Editou projeto ${newName}`,
        data: { projectId: project.id, oldData: { name: oldName } },
        undo: async () => {
          await supabase.from('projects').update({ name: oldName }).eq('id', project.id);
          toast.success('Edição de projeto desfeita');
        },
      });

      showUndoToast(`Projeto editado: ${newName}`, async () => {
        await undo();
      });

      setTestResults(prev => ({ ...prev, [testId]: 'success' }));
    } catch (error) {
      console.error('Erro no teste de editar projeto:', error);
      toast.error('Erro ao editar projeto de teste');
      setTestResults(prev => ({ ...prev, [testId]: 'error' }));
    }
  };

  const testDeleteProject = async () => {
    const testId = 'test-delete-project';
    setTestResults(prev => ({ ...prev, [testId]: 'pending' }));
    
    try {
      // Cria um projeto apenas para deletar
      const testProject: Partial<Project> = {
        name: `Projeto para Deletar ${Date.now()}`,
        client: 'Cliente Teste',
        city: 'São Paulo',
        code: `DEL-${Date.now()}`,
        status: 'planning' as const,
        owner: 'Teste',
        suppliers: [],
      };

      const { data: created, error: createError } = await supabase
        .from('projects')
        .insert([testProject as any])
        .select()
        .single();

      if (createError) throw createError;

      // Deleta o projeto
      const { error: deleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', created.id);

      if (deleteError) throw deleteError;

      // Adiciona ação de undo
      addAction({
        type: 'DELETE_PROJECT',
        description: `Deletou projeto ${created.name}`,
        data: { projectData: created },
        undo: async () => {
          await supabase.from('projects').insert([created]);
          toast.success('Projeto restaurado');
        },
      });

      showUndoToast(`Projeto deletado: ${created.name}`, async () => {
        await undo();
      });

      setTestResults(prev => ({ ...prev, [testId]: 'success' }));
    } catch (error) {
      console.error('Erro no teste de deletar projeto:', error);
      toast.error('Erro ao deletar projeto de teste');
      setTestResults(prev => ({ ...prev, [testId]: 'error' }));
    }
  };

  const testCreateInstallation = async () => {
    const testId = 'test-create-installation';
    setTestResults(prev => ({ ...prev, [testId]: 'pending' }));
    
    try {
      // Busca primeiro projeto disponível
      const { data: projects } = await supabase
        .from('projects')
        .select('*')
        .limit(1);

      if (!projects || projects.length === 0) {
        toast.error('Nenhum projeto encontrado para criar instalação');
        setTestResults(prev => ({ ...prev, [testId]: 'error' }));
        return;
      }

      const testInstallation: Partial<Installation> = {
        project_id: projects[0].id,
        tipologia: 'Teste',
        codigo: Date.now(),
        descricao: `Instalação Teste ${Date.now()}`,
        quantidade: 1,
        pavimento: 'Térreo',
        installed: false,
        photos: [],
        revisado: false,
        revisao: 0,
      };

      const { data, error } = await supabase
        .from('installations')
        .insert([testInstallation as any])
        .select()
        .single();

      if (error) throw error;

      // Adiciona ação de undo
      addAction({
        type: 'CREATE_INSTALLATION',
        description: `Criou instalação ${data.descricao}`,
        data: { installationId: data.id },
        undo: async () => {
          await supabase.from('installations').delete().eq('id', data.id);
          toast.success('Instalação de teste removida');
        },
      });

      showUndoToast(`Instalação criada: ${data.descricao}`, async () => {
        await undo();
      });

      setTestResults(prev => ({ ...prev, [testId]: 'success' }));
    } catch (error) {
      console.error('Erro no teste de criar instalação:', error);
      toast.error('Erro ao criar instalação de teste');
      setTestResults(prev => ({ ...prev, [testId]: 'error' }));
    }
  };

  const testBulkOperation = async () => {
    const testId = 'test-bulk-operation';
    setTestResults(prev => ({ ...prev, [testId]: 'pending' }));
    
    try {
      // Busca primeiro projeto disponível
      const { data: projects } = await supabase
        .from('projects')
        .select('*')
        .limit(1);

      if (!projects || projects.length === 0) {
        toast.error('Nenhum projeto encontrado');
        setTestResults(prev => ({ ...prev, [testId]: 'error' }));
        return;
      }

      // Cria 3 instalações de teste
      const installations = [1, 2, 3].map(i => ({
        project_id: projects[0].id,
        tipologia: 'Teste Bulk',
        codigo: Date.now() + i,
        descricao: `Instalação Bulk ${i}`,
        quantidade: 1,
        pavimento: 'Térreo',
        installed: false,
        photos: [],
        revisado: false,
        revisao: 0,
      }));

      const { data, error } = await supabase
        .from('installations')
        .insert(installations as any)
        .select();

      if (error) throw error;

      // Adiciona ação de undo
      addAction({
        type: 'BULK_DELETE',
        description: `Criou ${data.length} instalações em lote`,
        data: { installationIds: data.map(i => i.id) },
        undo: async () => {
          await supabase.from('installations').delete().in('id', data.map(i => i.id));
          toast.success(`${data.length} instalações removidas`);
        },
      });

      showUndoToast(`${data.length} instalações criadas em lote`, async () => {
        await undo();
      });

      setTestResults(prev => ({ ...prev, [testId]: 'success' }));
    } catch (error) {
      console.error('Erro no teste de operação em lote:', error);
      toast.error('Erro na operação em lote');
      setTestResults(prev => ({ ...prev, [testId]: 'error' }));
    }
  };

  const test15Actions = async () => {
    const testId = 'test-15-actions';
    setTestResults(prev => ({ ...prev, [testId]: 'pending' }));
    
    try {
      toast.info('Criando 15 ações de teste...');
      
      for (let i = 0; i < 15; i++) {
        addAction({
          type: 'CREATE_PROJECT',
          description: `Ação de teste #${i + 1}`,
          data: { testNumber: i + 1 },
          undo: async () => {
            console.log(`Undo ação #${i + 1}`);
          },
        });
      }

      toast.success('15 ações criadas. Verifique o histórico (deve ter apenas 10)');
      setTestResults(prev => ({ ...prev, [testId]: 'success' }));
    } catch (error) {
      console.error('Erro no teste de 15 ações:', error);
      toast.error('Erro ao criar 15 ações');
      setTestResults(prev => ({ ...prev, [testId]: 'error' }));
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Tem certeza que deseja limpar todo o histórico de undo?')) {
      clearHistory();
      toast.success('Histórico de undo limpo');
      setTestResults({});
    }
  };

  const handleUndo = async () => {
    try {
      const success = await undo();
      if (success) {
        toast.success('Ação desfeita com sucesso');
      } else {
        toast.info('Não há ações para desfazer');
      }
    } catch (error) {
      console.error('Erro ao desfazer:', error);
      toast.error('Erro ao desfazer ação');
    }
  };

  const formatActionTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('pt-BR', {
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

      {/* Undo System Tests */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Undo2 className="h-5 w-5" />
                Sistema de Undo - Testes
              </CardTitle>
              <CardDescription>
                Teste o sistema de desfazer ações e visualize o histórico
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleUndo}
                variant="outline"
                size="sm"
                disabled={!canUndo}
              >
                <Undo2 className="h-4 w-4 mr-2" />
                Desfazer (Ctrl+Z)
              </Button>
              <Button
                onClick={handleClearHistory}
                variant="destructive"
                size="sm"
                disabled={history.length === 0}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar Histórico
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Test Buttons Grid */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <PlayCircle className="h-4 w-4" />
              Testes de Ações
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <Button
                onClick={testCreateProject}
                variant="secondary"
                className="justify-start"
              >
                {testResults['test-create-project'] === 'success' && <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />}
                {testResults['test-create-project'] === 'error' && <XCircle className="h-4 w-4 mr-2 text-red-500" />}
                Criar Projeto
              </Button>
              
              <Button
                onClick={testEditProject}
                variant="secondary"
                className="justify-start"
              >
                {testResults['test-edit-project'] === 'success' && <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />}
                {testResults['test-edit-project'] === 'error' && <XCircle className="h-4 w-4 mr-2 text-red-500" />}
                Editar Projeto
              </Button>
              
              <Button
                onClick={testDeleteProject}
                variant="secondary"
                className="justify-start"
              >
                {testResults['test-delete-project'] === 'success' && <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />}
                {testResults['test-delete-project'] === 'error' && <XCircle className="h-4 w-4 mr-2 text-red-500" />}
                Deletar Projeto
              </Button>
              
              <Button
                onClick={testCreateInstallation}
                variant="secondary"
                className="justify-start"
              >
                {testResults['test-create-installation'] === 'success' && <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />}
                {testResults['test-create-installation'] === 'error' && <XCircle className="h-4 w-4 mr-2 text-red-500" />}
                Criar Instalação
              </Button>
              
              <Button
                onClick={testBulkOperation}
                variant="secondary"
                className="justify-start"
              >
                {testResults['test-bulk-operation'] === 'success' && <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />}
                {testResults['test-bulk-operation'] === 'error' && <XCircle className="h-4 w-4 mr-2 text-red-500" />}
                Operação em Lote (3 itens)
              </Button>
              
              <Button
                onClick={test15Actions}
                variant="secondary"
                className="justify-start"
              >
                {testResults['test-15-actions'] === 'success' && <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />}
                {testResults['test-15-actions'] === 'error' && <XCircle className="h-4 w-4 mr-2 text-red-500" />}
                Criar 15 Ações (Testar Limite)
              </Button>
            </div>
          </div>

          <Separator />

          {/* Undo History */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico de Undo ({history.length}/10)
            </h3>
            
            {history.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma ação no histórico</p>
                <p className="text-sm mt-2">
                  Execute uma ação de teste para começar
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((action, index) => (
                  <div
                    key={action.id}
                    className={`p-3 rounded-lg border ${
                      index === history.length - 1
                        ? 'bg-primary/5 border-primary'
                        : 'bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={index === history.length - 1 ? 'default' : 'secondary'}>
                            {action.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatActionTimestamp(action.timestamp)}
                          </span>
                          {index === history.length - 1 && (
                            <Badge variant="outline" className="text-xs">
                              Última ação
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm">{action.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Info Section */}
          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Instruções de Teste
            </h3>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Execute uma ação de teste e observe o toast com botão "Desfazer"</li>
              <li>• Clique em "Desfazer" no toast ou use Ctrl+Z para desfazer</li>
              <li>• O histórico mostra as últimas 10 ações (limite do sistema)</li>
              <li>• O histórico persiste durante a sessão (SessionStorage)</li>
              <li>• Recarregar a página mantém o histórico</li>
              <li>• Fechar a aba limpa o histórico (comportamento do SessionStorage)</li>
            </ul>
          </div>

          {/* Limitations Section */}
          <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Limitações Conhecidas
            </h3>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• ❌ Undo não funciona após fechar a aba (SessionStorage é limpo)</li>
              <li>• ❌ Undo não funciona entre dispositivos diferentes</li>
              <li>• ⚠️ Máximo de 10 ações mantidas no histórico</li>
              <li>• ⚠️ Funções undo() não são persistidas (apenas dados de ação)</li>
              <li>• ⚠️ Ao recarregar, funções undo são reconstruídas dinamicamente</li>
              <li>• ✅ Toast desaparece após 10 segundos automaticamente</li>
              <li>• ✅ Ctrl+Z funciona globalmente (exceto em inputs de texto)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Error Boundary Test Section */}
      {isDevelopment && (
        <div className="mt-8">
          <LoadingBoundary>
            <ErrorBoundaryTest />
          </LoadingBoundary>
        </div>
      )}
    </div>
  );
}
