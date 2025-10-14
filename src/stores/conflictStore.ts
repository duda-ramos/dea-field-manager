import { createElement, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { ConflictDetails } from '@/lib/conflictUtils';
import { logger } from '@/services/logger';

/**
 * Estrutura de dados base do store de conflitos
 * Mantém o estado atual e histórico de conflitos pendentes
 */
interface ConflictStoreData {
  currentConflict: ConflictDetails | null;
  showConflictAlert: boolean;
  pendingConflicts: ConflictDetails[];
}

/**
 * Interface completa do store de conflitos
 * Inclui dados e todas as ações disponíveis para gerenciar conflitos
 */
export interface ConflictState extends ConflictStoreData {
  addConflict: (conflict: ConflictDetails) => void;
  showNextConflict: () => void;
  hideConflictAlert: () => void;
  resolveCurrentConflict: () => void;
  showConflictNotification: () => void;
  clearAllConflicts: () => void;
  getPendingCount: () => number;
}

type SetStateValue = Partial<ConflictState> | ConflictState | void;
type SetStateInput = SetStateValue | ((state: ConflictState) => SetStateValue);

type ConflictStoreListener = () => void;

const STORAGE_KEY = 'dea-conflict-store';
const isBrowser = typeof window !== 'undefined';

const defaultData: ConflictStoreData = {
  currentConflict: null,
  showConflictAlert: false,
  pendingConflicts: [],
};

const listeners = new Set<ConflictStoreListener>();

const notifySubscribers = () => {
  listeners.forEach((listener) => listener());
};

/**
 * Verifica se dois conflitos são iguais
 * Compara por tipo de registro e ID da versão local
 * @param a - Primeiro conflito para comparação
 * @param b - Segundo conflito para comparação
 * @returns true se os conflitos se referem ao mesmo registro
 */
const isSameConflict = (
  a: ConflictDetails | null,
  b: ConflictDetails | null
): boolean => {
  if (!a || !b) {
    return false;
  }

  return (
    a.recordType === b.recordType &&
    a.localVersion.id === b.localVersion.id
  );
};

/**
 * Carrega dados persistidos do localStorage
 * Restaura conflitos pendentes da sessão anterior
 * @returns Estado inicial do store com dados persistidos
 */
const loadPersistedData = (): ConflictStoreData => {
  if (!isBrowser) {
    return { ...defaultData };
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { ...defaultData };
    }

    const parsed = JSON.parse(stored) as { pendingConflicts?: ConflictDetails[] };
    const pendingConflicts = parsed.pendingConflicts || [];
    
    // Se houver conflitos pendentes, o primeiro será o currentConflict
    let currentConflict: ConflictDetails | null = null;
    let remainingConflicts = pendingConflicts;
    
    if (pendingConflicts.length > 0) {
      [currentConflict, ...remainingConflicts] = pendingConflicts;
    }
    
    return {
      currentConflict,
      showConflictAlert: false, // Sempre inicia fechado
      pendingConflicts: remainingConflicts,
    };
  } catch (error) {
    logger.warn('[ConflictStore] Failed to load from storage', error);
    return { ...defaultData };
  }
};

let currentState: ConflictState;

/**
 * Persiste estado atual no localStorage
 * Salva todos os conflitos (atual + pendentes) para recuperação futura
 * Executado automaticamente após cada mudança de estado
 */
const persistState = () => {
  if (!isBrowser) {
    return;
  }

  try {
    // Persistir apenas pendingConflicts
    // Se houver currentConflict, inclui-lo no array para não perder
    const allPendingConflicts = currentState.currentConflict
      ? [currentState.currentConflict, ...currentState.pendingConflicts]
      : currentState.pendingConflicts;
    
    const dataToPersist = {
      pendingConflicts: allPendingConflicts,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToPersist));
  } catch (error) {
    logger.warn('[ConflictStore] Failed to persist state', error);
  }
};

const getState = () => currentState;

const setState = (input: SetStateInput) => {
  const nextPartial = typeof input === 'function' ? input(currentState) : input;

  if (!nextPartial || nextPartial === currentState) {
    return;
  }

  const nextState = { ...currentState, ...nextPartial } as ConflictState;

  if (
    nextState.currentConflict === currentState.currentConflict &&
    nextState.showConflictAlert === currentState.showConflictAlert &&
    nextState.pendingConflicts === currentState.pendingConflicts
  ) {
    return;
  }

  currentState = nextState;
  persistState();
  notifySubscribers();
};

const subscribe = (listener: ConflictStoreListener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const useStore = () =>
  useSyncExternalStore<ConflictState>(subscribe, getState, getState);

const initializeState = (): ConflictState => {
  const base = loadPersistedData();

  const store: ConflictState = {
    ...base,
    /**
     * Adiciona um novo conflito ao store
     * - Evita duplicatas verificando conflitos existentes
     * - Define como conflito atual se não houver nenhum ativo
     * - Adiciona à fila de pendentes caso contrário
     * @param conflict - Detalhes do conflito detectado
     */
    addConflict: (conflict) => {
      setState((state) => {
        const existsInPending = state.pendingConflicts.some((c) =>
          isSameConflict(c, conflict)
        );

        const matchesCurrent = isSameConflict(state.currentConflict, conflict);

        if (existsInPending || matchesCurrent) {
          if (matchesCurrent && !state.showConflictAlert) {
            return { showConflictAlert: true } satisfies Partial<ConflictState>;
          }

          return state;
        }

        const newConflicts = [...state.pendingConflicts, conflict];

        if (!state.currentConflict) {
          return {
            pendingConflicts: newConflicts,
            currentConflict: conflict,
            showConflictAlert: true,
          } satisfies Partial<ConflictState>;
        }

        return { pendingConflicts: newConflicts } satisfies Partial<ConflictState>;
      });
    },
    /**
     * Avança para o próximo conflito na fila
     * Remove o primeiro conflito pendente e o define como atual
     * Limpa o estado se não houver mais conflitos
     */
    showNextConflict: () => {
      setState((state) => {
        if (state.pendingConflicts.length === 0) {
          return {
            currentConflict: null,
            showConflictAlert: false,
            pendingConflicts: [],
          } satisfies Partial<ConflictState>;
        }

        const [next, ...remaining] = state.pendingConflicts;
        return {
          currentConflict: next,
          pendingConflicts: remaining,
          showConflictAlert: true,
        } satisfies Partial<ConflictState>;
      });
    },
    hideConflictAlert: () => {
      setState({ showConflictAlert: false });
    },
    resolveCurrentConflict: () => {
      const { showNextConflict } = getState();
      showNextConflict();
    },
    /**
     * Exibe notificação toast sobre conflitos pendentes
     * Permite ao usuário abrir o modal de resolução diretamente
     * Mostra contagem total de conflitos (atual + pendentes)
     */
    showConflictNotification: () => {
      const state = getState();
      const pendingCount = state.pendingConflicts.length;
      const currentShowing = state.currentConflict ? 1 : 0;
      const totalConflicts = pendingCount + currentShowing;

      if (totalConflicts > 0) {
        const title = `${totalConflicts} ${
          totalConflicts === 1
            ? 'edição simultânea detectada'
            : 'edições simultâneas detectadas'
        }`;

        toast.warning(title, {
          description: 'Clique para resolver',
          icon: createElement(AlertTriangle, { className: 'h-4 w-4' }),
          action: {
            label: 'Resolver',
            onClick: () => {
              const current = getState();
              if (!current.showConflictAlert && current.currentConflict) {
                setState({ showConflictAlert: true });
              }
            },
          },
          duration: 10000,
        });
      }
    },
    clearAllConflicts: () => {
      setState({
        currentConflict: null,
        showConflictAlert: false,
        pendingConflicts: [],
      });
    },
    getPendingCount: () => {
      const state = getState();
      return state.pendingConflicts.length + (state.currentConflict ? 1 : 0);
    },
  };

  return store;
};

currentState = initializeState();

const conflictStoreHook = Object.assign(useStore, {
  getState,
  setState,
  subscribe,
});

export const conflictStore: (() => ConflictState) & {
  getState: typeof getState;
  setState: typeof setState;
  subscribe: typeof subscribe;
} = conflictStoreHook;
