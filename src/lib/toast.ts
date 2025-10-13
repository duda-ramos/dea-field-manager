import toast from 'react-hot-toast';
import { toast as sonnerToast, ExternalToast } from 'sonner';

/**
 * Toast notification utilities using react-hot-toast
 * These provide consistent, modern toast feedback across the application
 */

export const showToast = {
  success: (message: string, description?: string) => {
    toast.success(description ? `${message}\n${description}` : message, {
      duration: 3000,
      position: 'top-right',
    });
  },

  error: (message: string, description?: string) => {
    toast.error(description ? `${message}\n${description}` : message, {
      duration: 4000,
      position: 'top-right',
    });
  },

  loading: (message: string) => {
    return toast.loading(message, {
      position: 'top-right',
    });
  },

  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    }
  ) => {
    return toast.promise(
      promise,
      messages,
      {
        position: 'top-right',
      }
    );
  },

  dismiss: (toastId: string) => {
    toast.dismiss(toastId);
  },

  dismissAll: () => {
    toast.dismiss();
  },
};

/**
 * Mostra um toast com botão "Desfazer" usando Sonner
 * @param message - Mensagem a ser exibida no toast
 * @param onUndo - Função async a ser executada ao clicar em "Desfazer"
 * @param options - Opções adicionais do toast (Sonner)
 */
export const showUndoToast = (
  message: string,
  onUndo: () => Promise<void>,
  options?: ExternalToast
) => {
  sonnerToast(message, {
    ...options,
    action: {
      label: 'Desfazer',
      onClick: async () => {
        try {
          await onUndo();
          sonnerToast.success('Ação desfeita');
        } catch (error) {
          console.error('Erro ao desfazer:', error);
          sonnerToast.error('Não foi possível desfazer');
        }
      }
    },
    duration: 10000 // 10 segundos
  });
};
