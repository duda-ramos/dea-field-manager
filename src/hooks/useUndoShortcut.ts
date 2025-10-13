/**
 * Hook para atalho de teclado Ctrl+Z / Cmd+Z
 * Executa undo global e mostra feedback visual
 */

import { useEffect } from 'react';
import { useUndo } from './useUndo';
import { toast } from 'sonner';

/**
 * Hook que adiciona suporte a atalho Ctrl+Z (ou Cmd+Z no Mac)
 * Deve ser usado no componente raiz da aplicação
 */
export function useUndoShortcut() {
  const { undo, canUndo, lastAction } = useUndo();

  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      // Detecta Ctrl+Z (Windows/Linux) ou Cmd+Z (Mac)
      const isUndoShortcut = (event.ctrlKey || event.metaKey) && event.key === 'z';
      
      if (!isUndoShortcut) {
        return;
      }

      // Previne comportamento padrão do navegador
      event.preventDefault();

      // Verifica se há ações para desfazer
      if (!canUndo) {
        toast.info('Não há ações para desfazer', {
          duration: 2000,
        });
        return;
      }

      // Tenta executar o undo
      try {
        const actionDescription = lastAction?.description || 'última ação';
        const success = await undo();
        
        if (success) {
          toast.success(`Desfeito: ${actionDescription}`, {
            duration: 3000,
          });
        } else {
          toast.error('Não foi possível desfazer', {
            duration: 3000,
          });
        }
      } catch (error) {
        console.error('Erro ao executar undo via atalho:', error);
        toast.error('Erro ao desfazer a ação', {
          duration: 3000,
        });
      }
    };

    // Adiciona event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [undo, canUndo, lastAction]);

  // Retorna informações úteis sobre o estado do undo
  return {
    canUndo,
    lastAction,
  };
}
