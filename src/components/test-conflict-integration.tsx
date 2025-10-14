import React from 'react';
import { Button } from '@/components/ui/button';
import { conflictStore } from '@/stores/conflictStore';
import { ConflictDetails } from '@/lib/conflictUtils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function TestConflictIntegration() {
  const createTestConflict = (): ConflictDetails => ({
    recordType: 'installation',
    recordName: 'Instalação Local',
    localVersion: {
      id: 'test-' + Date.now(),
      name: 'Instalação Local',
      updated_at: new Date().toISOString(),
      version: 2,
    },
    remoteVersion: {
      id: 'test-' + Date.now(),
      name: 'Instalação Remota',
      updated_at: new Date(Date.now() - 60000).toISOString(), // 1 minuto atrás
      version: 3,
    },
  });

  const addSingleConflict = () => {
    const conflict = createTestConflict();
    conflictStore.getState().addConflict(conflict);
  };

  const addMultipleConflicts = () => {
    for (let i = 0; i < 3; i++) {
      const conflict = createTestConflict();
      conflictStore.getState().addConflict(conflict);
    }
  };

  const clearAllConflicts = () => {
    conflictStore.getState().clearAllConflicts();
  };

  const showNotification = () => {
    conflictStore.getState().showConflictNotification();
  };

  const currentState = conflictStore();

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Teste de Integração - ConflictManager</CardTitle>
        <CardDescription>
          Use os botões abaixo para testar o sistema de conflitos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Estado Atual:</p>
            <div className="text-sm space-y-1">
              <p>Conflitos pendentes: {currentState.getPendingCount()}</p>
              <p>Modal aberto: {currentState.showConflictAlert ? 'Sim' : 'Não'}</p>
              <p>Conflito atual: {currentState.currentConflict ? 'Sim' : 'Não'}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={addSingleConflict}
              variant="default"
            >
              Adicionar 1 Conflito
            </Button>

            <Button 
              onClick={addMultipleConflicts}
              variant="secondary"
            >
              Adicionar 3 Conflitos
            </Button>

            <Button 
              onClick={showNotification}
              variant="outline"
            >
              Mostrar Notificação
            </Button>

            <Button 
              onClick={clearAllConflicts}
              variant="destructive"
            >
              Limpar Todos
            </Button>
          </div>

          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <p className="text-sm font-medium mb-2">Como testar:</p>
            <ol className="text-sm space-y-1 list-decimal list-inside">
              <li>Clique em "Adicionar 1 Conflito" para criar um conflito de teste</li>
              <li>Observe o ConflictBadge aparecer no header</li>
              <li>Clique no badge para abrir o modal de resolução</li>
              <li>Teste adicionar múltiplos conflitos</li>
              <li>Após resolver um conflito, o próximo será exibido automaticamente</li>
            </ol>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}