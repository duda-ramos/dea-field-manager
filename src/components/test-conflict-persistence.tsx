'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { conflictStore } from '@/stores/conflictStore';
import { ConflictDetails } from '@/lib/conflictUtils';

export function TestConflictPersistence() {
  const state = conflictStore();

  const createTestConflict = (): ConflictDetails => ({
    recordType: 'assessment',
    recordName: 'Avaliação de teste',
    localVersion: {
      id: `test-${Date.now()}`,
      data: { 
        name: 'Versão Local',
        description: 'Esta é a versão local do registro'
      },
      updatedAt: new Date().toISOString(),
    },
    remoteVersion: {
      id: `test-${Date.now()}`,
      data: { 
        name: 'Versão Remota',
        description: 'Esta é a versão remota do registro'
      },
      updatedAt: new Date(Date.now() - 60000).toISOString(), // 1 minuto atrás
    },
  });

  const handleAddConflict = () => {
    const conflict = createTestConflict();
    state.addConflict(conflict);
  };

  const handleClearAll = () => {
    state.clearAllConflicts();
  };

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <Card className="max-w-2xl mx-auto mt-8">
      <CardHeader>
        <CardTitle>Teste de Persistência de Conflitos</CardTitle>
        <CardDescription>
          Use este componente para testar a persistência de conflitos ao recarregar a página
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-muted rounded-lg space-y-2">
          <p className="text-sm">
            <strong>Conflito Atual:</strong> {state.currentConflict ? state.currentConflict.localVersion.id : 'Nenhum'}
          </p>
          <p className="text-sm">
            <strong>Conflitos Pendentes:</strong> {state.pendingConflicts.length}
          </p>
          <p className="text-sm">
            <strong>Modal Aberto:</strong> {state.showConflictAlert ? 'Sim' : 'Não'}
          </p>
          <p className="text-sm">
            <strong>Total de Conflitos:</strong> {state.getPendingCount()}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleAddConflict} variant="default">
            Adicionar Conflito de Teste
          </Button>
          
          <Button onClick={() => state.showConflictAlert && state.hideConflictAlert()} variant="secondary">
            Fechar Modal
          </Button>
          
          <Button 
            onClick={() => {
              if (!state.showConflictAlert && state.currentConflict) {
                // Usa o método showNextConflict para exibir o conflito atual
                state.showNextConflict();
              }
            }} 
            variant="secondary"
            disabled={!state.currentConflict || state.showConflictAlert}
          >
            Abrir Modal
          </Button>
          
          <Button onClick={() => state.resolveCurrentConflict()} variant="secondary">
            Resolver Conflito Atual
          </Button>
          
          <Button onClick={handleClearAll} variant="destructive">
            Limpar Todos
          </Button>
          
          <Button onClick={handleReload} variant="outline">
            Recarregar Página (F5)
          </Button>
        </div>

        <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg">
          <h4 className="font-semibold mb-2">Instruções de Teste:</h4>
          <ol className="list-decimal list-inside space-y-1">
            <li>Clique em "Adicionar Conflito de Teste" para criar conflitos</li>
            <li>Observe o badge no header mostrando o número de conflitos</li>
            <li>Clique em "Recarregar Página" ou pressione F5</li>
            <li>Verifique se os conflitos persistiram após o reload</li>
            <li>O modal deve estar fechado, mas os conflitos devem permanecer</li>
            <li>Clique no badge ou em "Abrir Modal" para ver os conflitos</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}