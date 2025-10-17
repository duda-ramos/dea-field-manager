/**
 * Hook customizado para gerenciar undo/redo
 * Fornece interface simples para adicionar ações e executar undo
 */

import { useState, useCallback, useEffect } from 'react';
import { Action, ActionType, getUndoManager } from '@/lib/undo';

// Tipo para adicionar ação (sem id e timestamp que são gerados automaticamente)
export type AddActionParams = Omit<Action, 'id' | 'timestamp'>;

export interface UseUndoReturn {
  addAction: (action: AddActionParams) => void;
  undo: () => Promise<boolean>;
  canUndo: boolean;
  lastAction: Action | null;
  clearHistory: () => void;
  history: Action[];
}

/**
 * Hook que fornece funcionalidades de undo/redo
 */
export function useUndo(): UseUndoReturn {
  const [undoManager] = useState(() => getUndoManager());
  const [, setHistoryVersion] = useState(0);

  // Estado derivado do histórico
  const history = undoManager.getHistory();
  const canUndo = undoManager.canUndo();
  const lastAction = undoManager.getLastAction();

  /**
   * Adiciona uma ação ao histórico
   * Gera id e timestamp automaticamente
   */
  const addAction = useCallback((action: AddActionParams) => {
    const fullAction: Action = {
      ...action,
      id: generateActionId(),
      timestamp: Date.now(),
    };

    undoManager.addAction(fullAction);
    
    // Força atualização do componente
    setHistoryVersion(v => v + 1);
  }, [undoManager]);

  /**
   * Executa o undo da última ação
   * Retorna true se teve sucesso, false se não havia ação para desfazer
   */
  const undo = useCallback(async (): Promise<boolean> => {
    const lastAction = undoManager.getLastAction();
    
    if (!lastAction) {
      return false;
    }

    try {
      // Executa a função undo
      await lastAction.undo();
      
      // Remove a ação do histórico após executar com sucesso
      undoManager.removeLastAction();
      
      // Força atualização do componente
      setHistoryVersion(v => v + 1);
      
      return true;
    } catch (error) {
      console.error('Erro ao executar undo:', error);
      throw error;
    }
  }, [undoManager]);

  /**
   * Limpa todo o histórico
   */
  const clearHistory = useCallback(() => {
    undoManager.clear();
    
    // Força atualização do componente
    setHistoryVersion(v => v + 1);
  }, [undoManager]);

  // Efeito para registrar funções undo quando o componente monta
  useEffect(() => {
    // As funções undo específicas devem ser registradas pelos componentes
    // que usam este hook, através do método registerUndoFunction do undoManager
    
    // Recarrega o histórico do storage para reconstruir as funções
    undoManager.reloadFromStorage();
    setHistoryVersion(v => v + 1);
  }, [undoManager]);

  return {
    addAction,
    undo,
    canUndo,
    lastAction,
    clearHistory,
    history,
  };
}

/**
 * Gera um ID único para uma ação
 */
function generateActionId(): string {
  return `action_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Hook auxiliar para registrar funções de undo
 * Deve ser usado pelos componentes que implementam operações com undo
 */
export function useRegisterUndoFunctions(
  functions: Array<{ type: ActionType; undoFn: (data: any) => Promise<void> }>
): void {
  const undoManager = getUndoManager();

  useEffect(() => {
    // Registra todas as funções
    functions.forEach(({ type, undoFn }) => {
      undoManager.registerUndoFunction(type, undoFn);
    });

    // Recarrega o histórico para reconstruir as funções undo
    undoManager.reloadFromStorage();
  }, [undoManager, functions]);
}
