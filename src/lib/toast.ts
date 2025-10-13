import toast from 'react-hot-toast';

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
