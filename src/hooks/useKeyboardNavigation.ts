import { useEffect, useCallback } from 'react';

interface UseKeyboardNavigationProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (direction: 'up' | 'down') => void;
  onActivate?: () => void;
}

/**
 * Hook para adicionar navegação por teclado aos componentes
 */
export function useKeyboardNavigation({
  isOpen,
  onClose,
  onNavigate,
  onActivate
}: UseKeyboardNavigationProps) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isOpen) return;

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        onClose();
        break;
      
      case 'ArrowUp':
        if (onNavigate) {
          event.preventDefault();
          onNavigate('up');
        }
        break;
      
      case 'ArrowDown':
        if (onNavigate) {
          event.preventDefault();
          onNavigate('down');
        }
        break;
      
      case 'Enter':
      case ' ':
        if (onActivate && event.target instanceof HTMLElement && 
            event.target.getAttribute('role') === 'button') {
          event.preventDefault();
          onActivate();
        }
        break;
      
      case 'Tab':
        // Allow default tab behavior for focus management
        break;
      
      default:
        break;
    }
  }, [isOpen, onClose, onNavigate, onActivate]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      
      // Focus trap setup
      const focusableElements = document.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements.length > 0) {
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
        
        // Focus first element when modal opens
        setTimeout(() => firstElement?.focus(), 100);
      }
      
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, handleKeyDown]);
}