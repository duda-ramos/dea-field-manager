/**
 * Sistema de Undo/Redo com persistência em SessionStorage
 * Gerencia histórico de ações com limite de 10 ações
 */

// Tipos de ações suportadas
export type ActionType = 
  | 'CREATE_PROJECT'
  | 'UPDATE_PROJECT'
  | 'DELETE_PROJECT'
  | 'CREATE_INSTALLATION'
  | 'UPDATE_INSTALLATION'
  | 'DELETE_INSTALLATION'
  | 'BULK_UPDATE'
  | 'BULK_DELETE';

// Interface principal para ações
export interface Action {
  id: string;
  type: ActionType;
  description: string; // texto amigável: "Criou projeto X"
  timestamp: number;
  data: Record<string, unknown>; // dados necessários para undo
  undo: () => Promise<void>; // função que desfaz a ação
}

// Interface para serialização (sem a função undo)
interface SerializedAction {
  id: string;
  type: ActionType;
  description: string;
  timestamp: number;
  data: Record<string, unknown>;
}

// Chave para SessionStorage
const STORAGE_KEY = 'undo-history';

/**
 * Classe que gerencia o histórico de ações com undo/redo
 */
export class UndoManager {
  private history: Action[] = [];
  private readonly maxHistorySize: number = 10;
  private undoFunctions: Map<ActionType, (data: Record<string, unknown>) => Promise<void>> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Registra uma função de undo para um tipo de ação específico
   * Necessário para reconstruir as funções undo ao carregar do storage
   */
  registerUndoFunction(type: ActionType, undoFn: (data: Record<string, unknown>) => Promise<void>): void {
    this.undoFunctions.set(type, undoFn);
  }

  /**
   * Adiciona uma ação ao histórico
   * Se ultrapassar o limite de 10, remove a mais antiga (FIFO)
   */
  addAction(action: Action): void {
    // Adiciona a nova ação
    this.history.push(action);

    // Remove a ação mais antiga se ultrapassar o limite
    if (this.history.length > this.maxHistorySize) {
      this.history.shift(); // Remove a primeira (mais antiga)
    }

    // Salva no storage
    this.saveToStorage();
  }

  /**
   * Retorna a última ação do histórico
   */
  getLastAction(): Action | null {
    if (this.history.length === 0) {
      return null;
    }
    return this.history[this.history.length - 1];
  }

  /**
   * Remove a última ação do histórico
   * Usado após executar o undo
   */
  removeLastAction(): void {
    if (this.history.length > 0) {
      this.history.pop();
      this.saveToStorage();
    }
  }

  /**
   * Limpa todo o histórico
   */
  clear(): void {
    this.history = [];
    this.saveToStorage();
  }

  /**
   * Retorna o histórico completo
   */
  getHistory(): Action[] {
    return [...this.history];
  }

  /**
   * Verifica se há ações para desfazer
   */
  canUndo(): boolean {
    return this.history.length > 0;
  }

  /**
   * Salva o histórico no SessionStorage
   * IMPORTANTE: Não persiste a função undo(), apenas os dados
   */
  private saveToStorage(): void {
    try {
      const serialized: SerializedAction[] = this.history.map(action => ({
        id: action.id,
        type: action.type,
        description: action.description,
        timestamp: action.timestamp,
        data: action.data,
      }));

      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
    } catch (error) {
      console.error('Erro ao salvar histórico no SessionStorage:', error);
    }
  }

  /**
   * Carrega o histórico do SessionStorage
   * Reconstrói as funções undo() com base no type
   */
  private loadFromStorage(): void {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return;
      }

      const serialized: SerializedAction[] = JSON.parse(stored);
      
      // Reconstrói as ações com as funções undo
      this.history = serialized.map(action => {
        const undoFn = this.undoFunctions.get(action.type);
        
        return {
          ...action,
          undo: undoFn 
            ? () => undoFn(action.data)
            : async () => {
                console.warn(`Função undo não registrada para o tipo: ${action.type}`);
              }
        };
      });
    } catch (error) {
      console.error('Erro ao carregar histórico do SessionStorage:', error);
      this.history = [];
    }
  }

  /**
   * Recarrega o histórico do storage
   * Útil quando as funções undo são registradas após a inicialização
   */
  reloadFromStorage(): void {
    this.loadFromStorage();
  }
}

// Singleton instance
let undoManagerInstance: UndoManager | null = null;

/**
 * Retorna a instância singleton do UndoManager
 */
export function getUndoManager(): UndoManager {
  if (!undoManagerInstance) {
    undoManagerInstance = new UndoManager();
  }
  return undoManagerInstance;
}

/**
 * Reseta a instância singleton (útil para testes)
 */
export function resetUndoManager(): void {
  undoManagerInstance = null;
}
